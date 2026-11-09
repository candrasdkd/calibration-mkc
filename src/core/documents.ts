import type { CalculationResult, CalibrationRecord, DocumentKind, Instrument } from './types';
import { buildCentrifugeDocumentHtml } from './centrifugeDocuments';
import { buildInstrumentDocumentHtml } from './instrumentDocuments';
import { getInstrumentTemplateId } from './instruments';

export function buildDocumentHtml(record: CalibrationRecord, instrument: Instrument, result: CalculationResult, kind: DocumentKind): string {
  return getInstrumentTemplateId(instrument) === 'centrifuge'
    ? buildCentrifugeDocumentHtml(record, instrument, result, kind)
    : buildInstrumentDocumentHtml(record, instrument, result, kind);
}
