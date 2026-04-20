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

        <h1 className="font-display text-2xl font-bold text-foreground mb-6">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground mb-6">Last updated: March 31, 2026</p>

        <div className="prose prose-sm max-w-none space-y-5 text-foreground">
          <section>
            <h2 className="text-base font-bold text-foreground">1. Information We Collect</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We collect information you provide directly, including your name, email address, phone number, location, and profile details when you create an account. For service providers, we also collect business information, portfolio images, and verification documents.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">2. How We Use Your Information</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">We use your information to:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Provide, maintain, and improve our services</li>
              <li>Connect clients with service providers</li>
              <li>Process bookings and payments</li>
              <li>Send notifications about your account and bookings</li>
              <li>Verify provider identities and qualifications</li>
              <li>Ensure platform safety and prevent fraud</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">3. Data Storage & Security</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your data is stored securely using industry-standard encryption. We use HTTPS for all data transmission and encrypt sensitive information at rest. Payment information is processed through secure payment gateways and is never stored on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">4. Data Sharing</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We do not sell your personal information. We share limited data only with: service providers/clients you interact with, payment processors, and when required by law. Provider profiles and reviews are publicly visible on the platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">5. Your Rights</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">You have the right to:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Access and download your personal data</li>
              <li>Update or correct your information</li>
              <li>Delete your account and associated data</li>
              <li>Opt out of marketing communications</li>
              <li>Request data portability</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">6. Cookies & Analytics</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use essential cookies for authentication and session management. We collect anonymous usage analytics to improve our platform. You can manage cookie preferences through your device settings.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">7. Children's Privacy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Servio is not intended for use by anyone under the age of 18. We do not knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">8. Changes to This Policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this policy from time to time. We will notify you of any material changes through the app or via email. Continued use of the app after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">9. Contact Us</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For questions about this Privacy Policy or your data, contact us at privacy@servio.app
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
