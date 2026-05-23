import { Panel } from '../components/ui';

const privacySections = [
  ['What Bizzlo Collects', 'Student profile data, application records, partner user records, document metadata, support tickets, audit events, and uploaded student documents needed to process study-abroad applications.'],
  ['How It Is Used', 'Data is used to manage admissions workflows, verify documents, coordinate partner counselors and Videshway admin, provide support, secure the service, and meet legal obligations.'],
  ['Retention', 'Operational records are retained while the partner relationship is active. Audit metadata is redacted after the configured retention period. Student erasure requests are handled through the documented admin process.'],
  ['Subprocessors', 'Bizzlo uses Supabase for database, authentication, storage, and edge functions; Vercel for hosting; Cloudflare for security checks; and optional Resend, Sentry, and PostHog when configured.'],
];

const termsSections = [
  ['Authorized Use', 'Bizzlo is for Videshway-approved partner consultancies, counselors, administrators, and invited students only. Accounts may not be shared.'],
  ['Partner Responsibilities', 'Partners are responsible for collecting accurate student consent, uploading genuine documents, and keeping account credentials secure.'],
  ['Student Documents', 'Uploaded documents must belong to the relevant student and may be reviewed, rejected, downloaded, and submitted for admissions processing by authorized staff.'],
  ['Service Availability', 'Bizzlo is operated as an admissions workflow system. Planned maintenance, third-party outages, and force majeure events may affect access.'],
];

function LegalPage({ title, intro, sections }) {
  return (
    <main className="legal-page page-grid">
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
      </div>
      <Panel>
        <div className="legal-copy">
          {sections.map(([heading, body]) => (
            <section key={heading}>
              <h2>{heading}</h2>
              <p>{body}</p>
            </section>
          ))}
          <section>
            <h2>Contact</h2>
            <p>For privacy, deletion, export, or contractual questions, contact support@bizzlo.co.</p>
          </section>
        </div>
      </Panel>
    </main>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This launch policy describes how Bizzlo handles partner and student data. Final legal wording should be reviewed before public launch."
      sections={privacySections}
    />
  );
}

export function TermsOfService() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These launch terms define acceptable use for Videshway partners and invited students. Final legal wording should be reviewed before public launch."
      sections={termsSections}
    />
  );
}
