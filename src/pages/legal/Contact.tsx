import { COMPANY } from '../../lib/company'
import { Fill, LegalPage, Section, SupportEmail } from './LegalPage'

// Contact us: who runs Denti and how to reach them, as payment gateways require.

export function Contact() {
  return (
    <LegalPage title="Contact us">
      <Section title="Help and billing">
        <ul>
          <li>
            Email: <SupportEmail />
          </li>
          {COMPANY.supportPhone && (
            <li>
              Phone: <a href={`tel:${COMPANY.supportPhone.replace(/\s/g, '')}`} className="text-accent underline">{COMPANY.supportPhone}</a>
              {COMPANY.supportHours && `, ${COMPANY.supportHours}`}
            </li>
          )}
        </ul>
        <p>Please include your clinic's web address, such as denti.in/your-clinic, so we can help faster.</p>
      </Section>

      <Section title="Company">
        <ul>
          <li>{COMPANY.legalName}</li>
          <li>
            Registered office: <Fill field="address" />
          </li>
          <li>
            GSTIN: <Fill field="gstin" />
          </li>
        </ul>
      </Section>

      <Section title="Grievance Officer">
        <p>
          <Fill field="grievanceOfficer" />, <Fill field="grievanceEmail" />. For complaints about personal data, as our Privacy Policy
          explains.
        </p>
      </Section>
    </LegalPage>
  )
}
