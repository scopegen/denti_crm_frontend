import type { ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { AppLayout } from './layouts/AppLayout'
import { clinicPath } from './lib/clinic'
import { FindClinic } from './pages/FindClinic'
import { Landing } from './pages/Landing'
import { ImportPatients } from './pages/app/ImportPatients'
import { Account } from './pages/app/Account'
import { ActivityLog } from './pages/app/ActivityLog'
import { Dues } from './pages/app/Dues'
import { Login } from './pages/Login'
import { ResetPassword } from './pages/ResetPassword'
import { SharedDocument } from './pages/SharedDocument'
import { Signup } from './pages/Signup'
import { StyleGuide } from './pages/StyleGuide'
import { FollowUpsSection, PatientDetail, PatientHistorySection } from './pages/app/PatientDetail'
import { ConsultationsSection } from './pages/app/patient/ConsultationsSection'
import { BillSection } from './pages/app/patient/BillSection'
import { ImagesSection } from './pages/app/patient/ImagesSection'
import { MessagesSection } from './pages/app/patient/MessagesSection'
import { ToothChartSection } from './pages/app/patient/ToothChartSection'
import { TreatmentsSection } from './pages/app/patient/TreatmentsSection'
import { WhatsAppSettings } from './pages/app/WhatsAppSettings'
import { PatientForm } from './pages/app/PatientForm'
import { PatientList } from './pages/app/PatientList'
import { PlanPage } from './pages/app/PlanPage'
import { Services } from './pages/app/Services'
import { Settings } from './pages/app/Settings'
import { StaffPage } from './pages/app/StaffPage'
import { Today } from './pages/app/Today'
import { AuthProvider, useAuth } from './state/AuthContext'

// Every clinic's pages sit under its name in the address, the same way for every clinic:
//   /                        the home page: what Denti does, the plans, sign up and sign in
//   /login                   find your clinic, then its own sign in page
//   /signup                  a new clinic signs up: plan, details, email code
//   /smile-dental            the clinic's sign in page (reset-password below it for a forgotten password)
//   /smile-dental/d/<token>  a document the clinic sent a patient on WhatsApp; no sign in
//   /smile-dental/today      Today
//   /smile-dental/patients   Patients (new, SMILE-0042, SMILE-0042/edit below it)
//   /smile-dental/dues       Dues: who owes the clinic money (owner and receptionist)
//   /smile-dental/account    My account: your details, your signature, signing out
//   /smile-dental/settings   Settings, with plan, services and staff below it (owner and receptionist),
//                            and the Activity log (owner only)
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<FindClinic />} />
      <Route path="/style-guide" element={<StyleGuide />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/:clinic" element={<ClinicRoot />}>
        <Route index element={<Login />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="d/:token" element={<SharedDocument />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="today" element={<Today />} />
          <Route path="patients" element={<PatientList />} />
          <Route path="patients/new" element={<PatientForm />} />
          <Route path="patients/:code" element={<PatientDetail />}>
            <Route path="consultations" element={<ConsultationsSection />} />
            <Route path="treatments" element={<TreatmentsSection />} />
            <Route path="tooth-chart" element={<ToothChartSection />} />
            <Route
              path="bill"
              element={
                <AdminOnly>
                  <BillSection />
                </AdminOnly>
              }
            />
            <Route path="follow-ups" element={<FollowUpsSection />} />
            <Route path="images" element={<ImagesSection />} />
            <Route path="messages" element={<MessagesSection />} />
            <Route
              path="history"
              element={
                <OwnerOnly>
                  <PatientHistorySection />
                </OwnerOnly>
              }
            />
          </Route>
          <Route path="patients/:code/edit" element={<PatientForm />} />
          <Route path="account" element={<Account />} />
          <Route
            path="dues"
            element={
              <AdminOnly>
                <Dues />
              </AdminOnly>
            }
          />
          <Route
            path="settings"
            element={
              <AdminOnly>
                <Settings />
              </AdminOnly>
            }
          />
          <Route
            path="settings/plan"
            element={
              <AdminOnly>
                <PlanPage />
              </AdminOnly>
            }
          />
          <Route
            path="settings/activity"
            element={
              <OwnerOnly>
                <ActivityLog />
              </OwnerOnly>
            }
          />
          <Route
            path="settings/whatsapp"
            element={
              <AdminOnly>
                <WhatsAppSettings />
              </AdminOnly>
            }
          />
          <Route
            path="settings/import"
            element={
              <AdminOnly>
                <ImportPatients />
              </AdminOnly>
            }
          />
          <Route
            path="settings/services"
            element={
              <AdminOnly>
                <Services />
              </AdminOnly>
            }
          />
          <Route
            path="settings/staff"
            element={
              <AdminOnly>
                <StaffPage />
              </AdminOnly>
            }
          />
        </Route>
        <Route path="*" element={<BackToClinic />} />
      </Route>
    </Routes>
  )
}

// One sign in per clinic: the provider is keyed by the clinic name in the address.
function ClinicRoot() {
  const slug = (useParams().clinic ?? '').toLowerCase()
  return (
    <AuthProvider key={slug} clinicSlug={slug}>
      <Outlet />
    </AuthProvider>
  )
}

function BackToClinic() {
  const { clinicSlug } = useAuth()
  return <Navigate to={clinicPath(clinicSlug)} replace />
}

// Doctors never see settings; the server refuses them too.
function AdminOnly({ children }: { children: ReactNode }) {
  const { staff, clinicSlug } = useAuth()
  if (staff?.role !== 'owner' && staff?.role !== 'admin') return <Navigate to={clinicPath(clinicSlug, 'today')} replace />
  return <>{children}</>
}

// The Activity log is the owner's alone; the server refuses everyone else too.
function OwnerOnly({ children }: { children: ReactNode }) {
  const { staff, clinicSlug } = useAuth()
  if (staff?.role !== 'owner') return <Navigate to={clinicPath(clinicSlug, 'today')} replace />
  return <>{children}</>
}
