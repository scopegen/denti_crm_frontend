import { Button } from '../components/Button'
import { ButtonRow } from '../components/ButtonRow'
import { Field, SelectField } from '../components/Field'
import { Pill } from '../components/Pill'
import { orWords } from '../lib/display'

// A visual reference for the shared components and the frontend rules. Not linked from the app.
export function StyleGuide() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-10">
      <h1>Denti style guide</h1>

      <section className="flex flex-col gap-4">
        <h2>Buttons always sit on the right</h2>
        <div className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
          <ButtonRow>
            <Button variant="ghost">Cancel</Button>
            <Button>Save</Button>
          </ButtonRow>
          <ButtonRow>
            <Button variant="danger">Remove</Button>
            <Button variant="tint">Add tooth</Button>
            <Button variant="secondary">Download PDF</Button>
          </ButtonRow>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2>Pills</h2>
        <div className="flex flex-wrap gap-2">
          <Pill>Planned</Pill>
          <Pill variant="warning">Waiting</Pill>
          <Pill variant="success">Seen</Pill>
          <Pill variant="crit">Diabetes</Pill>
          <Pill variant="accent">Standard plan</Pill>
          <Pill variant="solid">Finished</Pill>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2>Form fields</h2>
        <form className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm" onSubmit={(e) => e.preventDefault()}>
          <Field label="Patient name" required placeholder="Full name" />
          <SelectField label="Gender" options={['Male', 'Female', 'Other']} />
          <ButtonRow>
            <Button variant="ghost">Cancel</Button>
            <Button type="submit">Register patient</Button>
          </ButtonRow>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <h2>Missing values use words, never a dash</h2>
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[12px] text-ink-faint">Email</span>
            <span className="text-body font-medium text-ink">{orWords(null)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] text-ink-faint">Doctor</span>
            <span className="text-body font-medium text-ink">{orWords('', 'No doctor assigned')}</span>
          </div>
        </div>
      </section>
    </div>
  )
}
