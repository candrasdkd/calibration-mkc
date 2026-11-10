export interface FormulaExpressions {
  correction: string;
  uncertainty: string;
  tolerance: string;
  testValue: string;
  pass: string;
}

export const defaultFormulaExpressions: FormulaExpressions = {
  correction: 'mean - setting',
  uncertainty: '2 * sqrt(ua^2 + (uCal/2)^2 + (resUut/(2*sqrt(3)))^2 + (resCal/(2*sqrt(3)))^2)',
  tolerance: 'max(absoluteTolerance, abs(setting)*tolerancePercent/100)',
  testValue: 'abs(correction) + u95',
  pass: 'testValue <= tolerance',
};

type FormulaValue = number | boolean;
type Variables = Record<string, number>;

const functions: Record<string, (...args: number[]) => number> = {
  abs: (value) => Math.abs(value),
  sqrt: (value) => Math.sqrt(value),
  min: (...values) => Math.min(...values),
  max: (...values) => Math.max(...values),
  pow: (base, exponent) => base ** exponent,
};

function tokenize(expression: string): string[] {
  const source = expression.trim();
  const tokens: string[] = [];
  const pattern = /\s*(?:(\d+(?:\.\d*)?|\.\d+)|([a-zA-Z_][a-zA-Z_0-9]*)|(<=|>=|==|!=|&&|\|\||[+\-*/^(),<>]))/y;
  let offset = 0;
  while (offset < source.length) {
    pattern.lastIndex = offset;
    const match = pattern.exec(source);
    if (!match) throw new Error(`Karakter tidak dikenal di posisi ${offset + 1}.`);
    tokens.push(match[1] ?? match[2] ?? match[3]);
    offset = pattern.lastIndex;
  }
  if (!tokens.length) throw new Error('Rumus belum diisi.');
  return tokens;
}

function finite(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Hasil rumus tidak berupa angka yang valid.');
  return value;
}

function numberValue(value: FormulaValue): number {
  if (typeof value !== 'number') throw new Error('Bagian rumus ini harus menghasilkan angka.');
  return finite(value);
}

function booleanValue(value: FormulaValue): boolean {
  if (typeof value !== 'boolean') throw new Error('Bagian rumus ini harus menghasilkan nilai logika.');
  return value;
}

function evaluateTokens(tokens: string[], variables: Variables): FormulaValue {
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];
  const expect = (token: string) => {
    if (take() !== token) throw new Error(`Rumus harus memuat "${token}".`);
  };

  const primary = (): FormulaValue => {
    const token = take();
    if (token === undefined) throw new Error('Rumus belum lengkap.');
    if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) return finite(Number(token));
    if (token === '(') {
      const value = logicalOr();
      expect(')');
      return value;
    }
    if (/^[a-zA-Z_]/.test(token)) {
      if (peek() !== '(') {
        if (!(token in variables)) throw new Error(`Variabel "${token}" tidak tersedia.`);
        return finite(variables[token]);
      }
      if (!(token in functions)) throw new Error(`Fungsi "${token}" tidak didukung.`);
      take();
      const args: number[] = [];
      if (peek() !== ')') {
        do {
          args.push(numberValue(logicalOr()));
          if (peek() !== ',') break;
          take();
        } while (true);
      }
      expect(')');
      if (!args.length || (['abs', 'sqrt'].includes(token) && args.length !== 1)
        || (token === 'pow' && args.length !== 2)) throw new Error(`Jumlah nilai untuk fungsi ${token} tidak sesuai.`);
      return finite(functions[token](...args));
    }
    throw new Error(`Nilai "${token}" tidak dikenali.`);
  };

  const power = (): FormulaValue => {
    const left = numberValue(primary());
    if (peek() !== '^') return left;
    take();
    return finite(left ** numberValue(unary()));
  };
  const unary = (): FormulaValue => {
    if (peek() === '+') { take(); return numberValue(unary()); }
    if (peek() === '-') { take(); return -numberValue(unary()); }
    return power();
  };
  const multiply = (): FormulaValue => {
    let value = numberValue(unary());
    while (peek() === '*' || peek() === '/') {
      const operator = take();
      const right = numberValue(unary());
      if (operator === '/' && right === 0) throw new Error('Rumus membagi dengan nol.');
      value = finite(operator === '*' ? value * right : value / right);
    }
    return value;
  };
  const add = (): FormulaValue => {
    let value = numberValue(multiply());
    while (peek() === '+' || peek() === '-') {
      const operator = take();
      const right = numberValue(multiply());
      value = finite(operator === '+' ? value + right : value - right);
    }
    return value;
  };
  const comparison = (): FormulaValue => {
    const left = add();
    const operator = peek();
    if (!['<', '<=', '>', '>=', '==', '!='].includes(operator)) return left;
    take();
    const right = numberValue(add());
    const leftNumber = numberValue(left);
    if (operator === '<') return leftNumber < right;
    if (operator === '<=') return leftNumber <= right;
    if (operator === '>') return leftNumber > right;
    if (operator === '>=') return leftNumber >= right;
    if (operator === '==') return leftNumber === right;
    return leftNumber !== right;
  };

  const logicalAnd = (): FormulaValue => {
    let value = comparison();
    while (peek() === '&&') {
      take();
      const right = booleanValue(comparison());
      value = booleanValue(value) && right;
    }
    return value;
  };
  const logicalOr = (): FormulaValue => {
    let value = logicalAnd();
    while (peek() === '||') {
      take();
      const right = booleanValue(logicalAnd());
      value = booleanValue(value) || right;
    }
    return value;
  };

  const result = logicalOr();
  if (position !== tokens.length) throw new Error(`Bagian rumus "${tokens[position]}" tidak dipakai.`);
  return result;
}

export function evaluateFormulaExpression(expression: string, variables: Variables): FormulaValue {
  return evaluateTokens(tokenize(expression), variables);
}

export function validateFormulaExpressions(expressions: FormulaExpressions): string | null {
  try {
    const values: Variables = {
      mean: 10, setting: 10, sd: 0.1, n: 5, ua: 0.1 / Math.sqrt(5),
      uCal: 0.2, resCal: 0.1, resUut: 0.1, tolerancePercent: 10, absoluteTolerance: 0,
    };
    values.correction = numberValue(evaluateFormulaExpression(expressions.correction, values));
    values.u95 = numberValue(evaluateFormulaExpression(expressions.uncertainty, values));
    values.tolerance = numberValue(evaluateFormulaExpression(expressions.tolerance, values));
    values.testValue = numberValue(evaluateFormulaExpression(expressions.testValue, values));
    if (values.u95 < 0 || values.tolerance < 0) throw new Error('Ketidakpastian dan toleransi tidak boleh negatif.');
    if (typeof evaluateFormulaExpression(expressions.pass, values) !== 'boolean') throw new Error('Rumus lulus harus menghasilkan perbandingan, misalnya testValue <= tolerance.');
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Rumus tidak valid.';
  }
}
