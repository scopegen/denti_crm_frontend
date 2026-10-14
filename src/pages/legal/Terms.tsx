import { Link } from 'react-router-dom'
import { COMPANY } from '../../lib/company'
import { Fill, LegalPage, Section, SupportEmail } from './LegalPage'

// The Terms of Service. A draft written from how Denti works today; the company should have it
// reviewed before going live.

export function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p className="text-body text-ink-soft">
        These terms are an agreement between your clinic and {COMPANY.legalName}, which runs Denti. By setting up a clinic or
        signing in, you agree to them. If you set up Denti for a clinic, you confirm you may agree on its behalf.
      </p>

      <Section title="What Denti is">
        <p>
          Denti is software for dental clinics in India to keep patient records, consultations, prescriptions, treatments, bills,
          X-rays and follow ups, and to send WhatsApp messages from the clinic's own phone. Denti is a record keeping tool. It does not
          give medical advice, and every clinical decision stays with the clinic's doctors.
        </p>
      </Section>

      <Section title="Your clinic's account and logins">
        <ul>
          <li>The owner's login is the main account. The owner adds receptionist and doctor logins, and is responsible for who has them.</li>
          <li>Every person uses their own login. Keep passwords private. Signing in on a new device also needs a code sent to your email.</li>
          <li>Tell us straight away if you think someone else is using a login of your clinic.</li>
        </ul>
      </Section>

      <Section title="Plans, prices and payment">
        <ul>
          <li>
            Plans and prices are shown on the <Link to="/#plans" className="text-accent underline">home page</Link>. Prices are in
            Indian rupees and GST at 18% is added.
          </li>
          <li>Every plan starts with a Starter pack for the first 3 months. After that the plan renews monthly or yearly, as you choose.</li>
          <li>Each period is paid in advance. If you set up AutoPay, each renewal is charged automatically at the start of the period.</li>
          <li>Payments are taken by our payment partner. Denti never sees or stores card numbers or UPI PINs.</li>
          <li>Every payment gets a GST invoice.</li>
          <li>We will tell you at least 30 days before any price change applies to your clinic.</li>
        </ul>
      </Section>

      <Section title="Moving to another plan">
        <ul>
          <li>Moving to a higher plan applies at once. You pay the price difference for the rest of the current period, plus GST.</li>
          <li>
            Moving to a lower plan applies when the current paid period ends. If the lower plan has fewer logins, the owner chooses who
            stays active, and the others are paused, never deleted.
          </li>
        </ul>
      </Section>

      <Section title="If a renewal is not paid">
        <p>
          We remind the owner before and after a renewal falls due. If it is still unpaid {COMPANY.graceDays} days after the due date,
          the clinic can only view its records until it pays. Nothing is deleted.
        </p>
      </Section>

      <Section title="Your clinic's data">
        <ul>
          <li>
            Patient records belong to your clinic. We keep and process them only to run Denti for you, as our{' '}
            <Link to="/privacy" className="text-accent underline">Privacy Policy</Link> explains.
          </li>
          <li>
            Your clinic is responsible for having the patient's permission to keep their records and to message them, as Indian law
            requires, and for keeping the records correct.
          </li>
          <li>Each clinic's data is kept apart from every other clinic's. Other clinics using Denti can never see it.</li>
        </ul>
      </Section>

      <Section title="Fair use">
        <p>Use Denti only for running your clinic, and lawfully. Do not:</p>
        <ul>
          <li>try to reach another clinic's data, or test or break Denti's security;</li>
          <li>upload anything unlawful, or files with viruses or harmful code;</li>
          <li>resell Denti, copy it, or use it to build a competing product.</li>
        </ul>
        <p>We may suspend a login or a clinic that breaks these rules, and will tell the owner why.</p>
      </Section>

      <Section title="Availability">
        <p>
          We work to keep Denti available at all times and to keep your data safe, with regular backups. Sometimes we need short
          maintenance, which we plan for quiet hours where possible. We cannot promise Denti will never be interrupted.
        </p>
      </Section>

      <Section title="Closing your clinic's account">
        <p>
          The owner can close the clinic's account at any time; it stays usable until the end of the period already paid. See{' '}
          <Link to="/terms/refunds" className="text-accent underline">Refunds and cancellation</Link>. After closing, we keep the
          clinic's data for {COMPANY.keepAfterClosingDays} days so the owner can ask for a full copy, then delete it, except billing
          records that tax law requires us to keep.
        </p>
      </Section>

      <Section title="Our responsibility">
        <p>
          We provide Denti with reasonable care and skill. To the extent the law allows, we are not responsible for indirect losses, such
          as lost income, and our total responsibility for any claim is limited to the fees your clinic paid us in the 12 months before
          it.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          We may update these terms as Denti changes. We will tell clinic owners by email at least 30 days before a change that affects
          them takes effect.
        </p>
      </Section>

      <Section title="Law and disputes">
        <p>
          These terms are governed by the laws of India. Any dispute will be heard by the courts of <Fill field="courtsCity" />.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          {COMPANY.legalName}, <Fill field="address" />. Email <SupportEmail />.
        </p>
      </Section>
    </LegalPage>
  )
}
