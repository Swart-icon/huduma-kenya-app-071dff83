import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-5 py-6 pb-12">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" /> <span>Back</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground mb-6">Last updated: May 14, 2026</p>

        <div className="prose prose-sm max-w-none space-y-5 text-foreground">
          <section>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Servio ("we", "our", "us") operates the Servio mobile application and website (the "Service"), a marketplace
              connecting clients, service providers, and job seekers in Kenya. This Privacy Policy explains how we collect,
              use, disclose, and protect your information when you use Servio. By using the Service you agree to this Policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">1. Information We Collect</h2>
            <p className="text-sm text-muted-foreground leading-relaxed font-semibold">a. Account &amp; Profile Data</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Name, email address, phone number, password (hashed), profile photo, gender (optional), date of birth (optional),
              role (Client / Provider / Job Seeker), business name, service categories, bio, portfolio media, and verification
              documents you upload.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed font-semibold mt-2">b. Location Data</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              With your permission, we collect precise location (GPS latitude/longitude) and approximate location (city,
              county) to show nearby providers/jobs and to power map-based discovery. Precise location is kept private — public
              profiles only display city and county. You can revoke location permission at any time in your device settings.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed font-semibold mt-2">c. Camera, Microphone &amp; Media</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              With your permission, we access camera and microphone to let you record short videos, capture profile photos,
              record voice notes, and make in-app voice/video calls. Photos and videos selected from your gallery are uploaded
              only when you submit them.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed font-semibold mt-2">d. Communication Data</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Messages, voice notes, file attachments, call metadata (duration, timestamps), and content you post (videos,
              stories, reviews, job listings).
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed font-semibold mt-2">e. Payment Data</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When you pay for premium features, story boosts, video boosts, or bookings, we process payments via M-Pesa
              (Safaricom Daraja) and Paystack. We store transaction IDs, amounts, status, and the phone number used. We do
              NOT store full card numbers or M-Pesa PINs — these are handled directly by the payment processor.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed font-semibold mt-2">f. Device &amp; Usage Data</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Device model, operating system version, app version, IP address, language, crash logs, session duration,
              feature usage, and notification tokens (for push notifications).
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed font-semibold mt-2">g. Notifications</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              With your permission we send push notifications for messages, bookings, job applications, and account
              activity. You can disable these in app settings or device settings.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">2. How We Use Your Information</h2>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Create and manage your account and profile</li>
              <li>Connect clients, providers, and job seekers</li>
              <li>Process bookings, payments, and payouts</li>
              <li>Show relevant nearby services, jobs, and recommendations</li>
              <li>Enable messaging, calls, video feed, and stories</li>
              <li>Send transactional and (with consent) marketing notifications</li>
              <li>Verify identity, prevent fraud, and enforce our Terms</li>
              <li>Improve performance, fix bugs, and develop new features</li>
              <li>Comply with legal obligations under Kenyan law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">3. Legal Basis (Kenya Data Protection Act, 2019)</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We process your data based on: your consent, performance of a contract (the Service you requested),
              compliance with legal obligations, and our legitimate interests (security, fraud prevention, service
              improvement).
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">4. Sharing &amp; Disclosure</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">We share data only as follows:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li><span className="font-semibold">Other users:</span> profile info, public posts, reviews, and messages you exchange.</li>
              <li><span className="font-semibold">Service providers:</span> Supabase (database, auth, storage hosted on AWS), Safaricom (M-Pesa), Paystack (cards), email/SMS providers, push-notification services, and analytics/crash-reporting tools.</li>
              <li><span className="font-semibold">Legal authorities:</span> when required by Kenyan law, court order, or to protect rights and safety.</li>
              <li><span className="font-semibold">Business transfers:</span> in the event of a merger, acquisition, or sale, with notice to you.</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              <span className="font-semibold">We do not sell your personal information.</span>
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">5. Data Security</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use HTTPS/TLS for data in transit, encryption at rest, hashed passwords, Row-Level Security on our
              database, signed URLs for private files, and access controls limited to authorized personnel. No system
              is 100% secure — please use a strong password and notify us immediately of any suspected unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">6. Data Retention</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We retain your data while your account is active. When you delete your account, personal data is removed
              within 30 days, except where retention is required for legal, tax, fraud-prevention, or dispute-resolution
              purposes (typically up to 7 years for financial records).
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">7. Your Rights</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">Under the Kenya Data Protection Act and GDPR (where applicable) you may:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Access, correct, or download your personal data</li>
              <li>Delete your account and associated data</li>
              <li>Restrict or object to certain processing</li>
              <li>Withdraw consent at any time</li>
              <li>Lodge a complaint with the Office of the Data Protection Commissioner (ODPC) Kenya</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              To exercise these rights, email <span className="font-semibold">privacy@servioafrica.com</span> or use the
              "Delete Account" option in app Settings.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">8. Account &amp; Data Deletion</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You can delete your account directly from <span className="font-semibold">Profile → Settings → Delete Account</span>,
              or by emailing <span className="font-semibold">privacy@servioafrica.com</span> with the subject "Account Deletion".
              We will confirm and complete deletion within 30 days. A web request form is also available at
              <span className="font-semibold"> https://www.servioafrica.com/delete-account</span>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">9. Children's Privacy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Servio is not directed to children under 18. We do not knowingly collect data from minors. If we learn we
              have collected data from a child, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">10. International Transfers</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Our service providers (e.g. Supabase, Paystack) may process data outside Kenya. We rely on appropriate
              safeguards (standard contractual clauses, provider security certifications) for such transfers.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">11. Third-Party Links &amp; Services</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The app may contain links or integrations with third-party services. We are not responsible for their
              privacy practices — please review their policies separately.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">12. Changes to This Policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this Policy from time to time. Material changes will be communicated via in-app notification
              or email. Continued use after changes means you accept the updated Policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">13. Contact Us</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-semibold">Servio</span><br />
              Email: privacy@servioafrica.com<br />
              Website: https://www.servioafrica.com<br />
              Data Protection Officer: dpo@servioafrica.com<br /><br />
              You may also contact the Office of the Data Protection Commissioner (ODPC) Kenya at
              <span className="font-semibold"> www.odpc.go.ke</span>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
