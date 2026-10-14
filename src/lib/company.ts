// The company behind Denti, as the Terms, Privacy, Refunds and Contact pages show it. Payment
// gateways check these pages before they let a business take payments, so every value must be
// true and complete before going live. An empty value shows as "To be added" on the pages.

export const COMPANY = {
  /** The registered business name, exactly as on the PAN and GST certificate. */
  legalName: 'Scopegen Softwares',
  /** The registered office address. */
  address: '',
  /** Where clinics write for help and about billing. */
  supportEmail: '',
  /** Optional: a phone number clinics can call. */
  supportPhone: '',
  /** Optional: when the phone is answered, such as "Monday to Saturday, 10 am to 6 pm". */
  supportHours: '',
  /** The GSTIN printed on Denti's invoices. */
  gstin: '',
  /** Name of the Grievance Officer, required by Indian law for complaints about data. */
  grievanceOfficer: '',
  /** The Grievance Officer's email. */
  grievanceEmail: '',
  /** The city whose courts hear disputes, such as "Bengaluru". */
  courtsCity: '',
  /** Where clinic data is stored, such as "Amazon Web Services, Mumbai, India". */
  dataLocation: '',
  /** Days a closed clinic's data is kept, so the owner can ask for a copy, before it is deleted. */
  keepAfterClosingDays: 90,
  /** Days a renewal can stay unpaid before the clinic can only view its records. */
  graceDays: 7,
  /** Days a charge made in error takes to come back to the clinic. */
  refundWorkingDays: 7,
  /** When these pages last changed. */
  updated: '14 October 2026',
}

export type CompanyField = {
  [K in keyof typeof COMPANY]: (typeof COMPANY)[K] extends string ? K : never
}[keyof typeof COMPANY]
