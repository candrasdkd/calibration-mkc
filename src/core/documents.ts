import type { CalculationResult, CalibrationRecord, DocumentKind, Instrument } from './types';
import { buildCentrifugeDocumentHtml } from './centrifugeDocuments';
import { buildInstrumentDocumentHtml } from './instrumentDocuments';

export function buildDocumentHtml(record: CalibrationRecord, instrument: Instrument, result: CalculationResult, kind: DocumentKind): string {
  return instrument.id === 'centrifuge'
    ? buildCentrifugeDocumentHtml(record, instrument, result, kind)
    : buildInstrumentDocumentHtml(record, instrument, result, kind);
}
