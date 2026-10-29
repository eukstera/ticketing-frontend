export function reservedMessage(ticketNumber: string): string {
  return `Ticket number ${ticketNumber} reserved. Blank job order downloaded.`
}

export function reservedNotDownloadedMessage(ticketNumber: string): string {
  return `Ticket number ${ticketNumber} was reserved, but the PDF wasn't downloaded. Use "Reprint JO" on that row.`
}

export const RESERVE_FAILED_FALLBACK = "Couldn't reserve a ticket number. Please try again."
