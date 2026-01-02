import { IsDateString, IsNotEmpty } from 'class-validator';

export class GenerateInvoiceDto {
  @IsDateString()
  @IsNotEmpty()
  month: string; // ISO date string (e.g., "2025-01-15T00:00:00.000Z")
}