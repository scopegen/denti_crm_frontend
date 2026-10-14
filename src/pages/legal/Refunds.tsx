import { COMPANY } from '../../lib/company'
import { LegalPage, Section, SupportEmail } from './LegalPage'

// Refunds and cancellation: what a clinic pays when it cancels or changes plan, and when money
// comes back. A draft of the company's rules; to be confirmed before going live.

export function Refunds() {
  return (
    <LegalPage title="Refunds and cancellation">
      <Section title="Cancelling">
        <ul>
          <li>The clinic owner can cancel at any time. Nothing more is charged after cancelling.</li>
          <li>The clinic keeps using Denti until the end of the period already paid for.</li>
          <li>The unused part of a period already started, including the Starter pack, is not refunded.</li>
          <li>
            After the paid period ends, the clinic's data is kept for {COMPANY.keepAfterClosingDays} days so the owner can ask for a
            full copy, and then deleted.
          </li>
        </ul>
      </Section>

      <Section title="Changing plan">
        <ul>
          <li>Moving to a higher plan applies at once, and you pay only the price difference for the rest of the current period, plus GST.</li>
          <li>Moving to a lower plan applies when the current paid period ends, so there is nothing to refund.</li>
        </ul>
      </Section>

      <Section title="AutoPay">
        <p>
          If you set up AutoPay, each renewal is charged at the start of its period. You can stop AutoPay at any time by cancelling in
          Denti, or from your UPI app or bank.
        </p>
      </Section>

      <Section title="Charges made in error">
        <p>
          If you were charged twice, charged after cancelling, or charged the wrong amount, we refund the extra amount in full to the
          same card, UPI account or bank account it was paid from, within {COMPANY.refundWorkingDays} working days of confirming it.
          Your bank may take a few more days to show it.
        </p>
      </Section>

      <Section title="How to ask">
        <p>
          Write to <SupportEmail /> with your clinic's web address (such as denti.in/your-clinic) and the payment reference from your
          invoice or payment receipt.
        </p>
      </Section>
    </LegalPage>
  )
}
