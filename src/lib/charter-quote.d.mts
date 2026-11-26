export interface CharterQuoteForm {
    name: string; email: string; phone: string; vehicleModelId: string; travelDate: string; startTime: string;
    hours: string; passengers: string; pickup: string; itinerary: string; luggage: string; notes: string; website: string;
}
export type CharterQuoteProblem = 'required' | 'email' | 'past' | 'passengers' | 'hours';
export interface CharterQuoteVehicle { id: string; name: string }
type CharterQuoteErrors = Partial<Record<keyof CharterQuoteForm, CharterQuoteProblem>>;
export const QUOTE_STEPS: Exclude<keyof CharterQuoteForm, 'website'>[][];
export function stepErrors(form: CharterQuoteForm, step: number, today?: string): CharterQuoteErrors;
export function firstStepWithError(errors: CharterQuoteErrors): number;
export function emptyQuote(vehicleModelId?: string): CharterQuoteForm;
export function vancouverToday(): string;
export function quoteErrors(form: CharterQuoteForm, today?: string): Partial<Record<keyof CharterQuoteForm, CharterQuoteProblem>>;
export function quotePayload(form: CharterQuoteForm, options: { lang: 'en' | 'zh'; requestId: string; vehicles: CharterQuoteVehicle[] }): Record<string, unknown>;
