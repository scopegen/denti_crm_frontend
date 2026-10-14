import { COMPANY } from '../../lib/company'
import { Fill, LegalPage, Section, SupportEmail } from './LegalPage'

// The Privacy Policy, written for India's Digital Personal Data Protection Act, 2023 from how
// Denti actually works. A draft; the company should have it reviewed before going live.

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p className="text-body text-ink-soft">
        {COMPANY.legalName} runs Denti. This policy explains what data Denti keeps, why, who can see it, and the choices you have.
      </p>

      <Section title="Two kinds of data">
        <ul>
          <li>
            <span className="font-medium text-ink">About clinics and their staff.</span> For this data, {COMPANY.legalName} decides
            how it is used, and is responsible for it as the Data Fiduciary.
          </li>
          <li>
            <span className="font-medium text-ink">Patient records a clinic keeps in Denti.</span> These belong to the clinic, which
            decides how they are used and is responsible for them. {COMPANY.legalName} only stores and processes them so the clinic
            can use Denti, following the clinic's instructions, as its Data Processor. Patients with questions about their records
            should ask their clinic first.
          </li>
        </ul>
      </Section>

      <Section title="What Denti keeps">
        <ul>
          <li>Clinic details: name, web address, plan, settings, and the GSTIN, logo and letterhead if added.</li>
          <li>
            Staff details: name, email, phone if given, role, and a doctor's signature image if added. Passwords are stored only in a
            scrambled form that nobody, including us, can read back.
          </li>
          <li>
            Sign in and activity records: when someone signed in, the device and browser, the internet address, and a log of who
            opened, downloaded or changed each record. The clinic owner can see this log.
          </li>
          <li>
            Patient records the clinic enters: name, age or date of birth, gender, phone, address, medical history, consultations,
            prescriptions, treatments, tooth chart, X-rays and photos, bills, payments and the WhatsApp messages opened for them.
          </li>
          <li>Sign up details: what the owner enters when setting up a clinic, with the internet address and device used.</li>
          <li>
            Payments: the amount, date, plan and payment reference, and the invoice. Payments are taken by our payment partner;
            Denti never sees or stores card numbers or UPI PINs.
          </li>
        </ul>
      </Section>

      <Section title="How Denti uses it">
        <ul>
          <li>To run Denti for the clinic and show each person what their role allows.</li>
          <li>To keep accounts safe: sign in codes by email, alerts when a password changes, and the activity log.</li>
          <li>To send emails about the account, such as sign in codes, renewals and invoices.</li>
          <li>To bill clinics and keep the records tax law requires.</li>
          <li>To help when a clinic asks for support.</li>
        </ul>
        <p>
          We never sell data, never show advertising, and never use patient records for anything except providing Denti to the clinic
          that keeps them.
        </p>
      </Section>

      <Section title="Cookies and browser storage">
        <p>
          Denti uses two cookies, only to keep you signed in and to remember a device you chose to trust for 30 days. The browser also
          remembers which setup steps the owner hid. Denti uses no advertising or tracking cookies.
        </p>
      </Section>

      <Section title="Who else handles data">
        <ul>
          <li>
            Service providers Denti needs to run: our hosting provider, which stores the data, our email provider, which delivers
            emails, and our payment partner, which takes payments. They may use the data only to provide their service to us.
          </li>
          <li>
            WhatsApp messages are sent from the clinic's own phone and WhatsApp. Denti only prepares the message. A link to a
            prescription, invoice or estimate in a message opens that one document for 30 days, and the clinic can stop it sooner.
          </li>
          <li>Government authorities, only when the law requires it.</li>
        </ul>
      </Section>

      <Section title="Where the data is stored">
        <p>
          <Fill field="dataLocation" />.
        </p>
      </Section>

      <Section title="How Denti protects it">
        <ul>
          <li>Connections to Denti are encrypted.</li>
          <li>Each clinic's data is kept apart by the database itself, so one clinic can never see another's.</li>
          <li>Signing in on a new device needs both the password and a code sent by email.</li>
          <li>Every opening, download and change of a patient record is logged for the clinic owner.</li>
          <li>Our team does not look at a clinic's records unless the clinic asks for help or the law requires it.</li>
        </ul>
      </Section>

      <Section title="How long it is kept">
        <ul>
          <li>For as long as the clinic uses Denti.</li>
          <li>Deleted X-rays, photos and documents stay in a bin for 30 days, so a mistake can be undone, and are then removed.</li>
          <li>
            When a clinic closes its account, its data is kept for {COMPANY.keepAfterClosingDays} days so the owner can ask for a full
            copy, and then deleted. Billing records are kept for as long as tax law requires.
          </li>
        </ul>
      </Section>

      <Section title="Your rights">
        <p>
          Under the Digital Personal Data Protection Act, 2023, you can ask for a summary of the data held about you, have it
          corrected or completed, have it erased when it is no longer needed, name someone to act for you, and raise a complaint.
        </p>
        <ul>
          <li>Clinic staff: ask your clinic's owner, or write to us.</li>
          <li>Patients: ask your clinic, which is responsible for your records. We help clinics answer these requests.</li>
        </ul>
      </Section>

      <Section title="Children">
        <p>
          Clinics treat children too. A clinic keeping a child's records is responsible for the consent of a parent or guardian, as the
          law requires.
        </p>
      </Section>

      <Section title="Grievance Officer">
        <p>
          For any complaint about your data, write to our Grievance Officer, <Fill field="grievanceOfficer" />, at{' '}
          <Fill field="grievanceEmail" />, or by post to {COMPANY.legalName}, <Fill field="address" />. We aim to resolve complaints
          within 15 days. If you are not satisfied, you may complain to the Data Protection Board of India.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          When this policy changes, we update the date at the top, and tell clinic owners by email about changes that affect them.
          Questions: <SupportEmail />.
        </p>
      </Section>
    </LegalPage>
  )
}
