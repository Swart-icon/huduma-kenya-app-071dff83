import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-5 py-6 pb-12">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" /> <span>Back</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-6">Terms of Service</h1>
        <p className="text-xs text-muted-foreground mb-6">Last updated: March 31, 2026</p>

        <div className="prose prose-sm max-w-none space-y-5 text-foreground">
          <section>
            <h2 className="text-base font-bold text-foreground">1. Acceptance of Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By accessing or using Servio, you agree to be bound by these Terms of Service. If you do not agree, please do not use the app. These terms apply to all users, including clients, service providers, and job seekers.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">2. User Accounts</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You must be at least 18 years old to create an account. You are responsible for maintaining the confidentiality of your account credentials. You must provide accurate and complete information during registration and keep it updated.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">3. Service Provider Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">Service providers agree to:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Provide accurate descriptions of their services</li>
              <li>Honour accepted bookings and agreed pricing</li>
              <li>Maintain professional conduct with clients</li>
              <li>Submit valid verification documents when requested</li>
              <li>Comply with all applicable laws and regulations in Kenya</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">4. Client Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">Clients agree to:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Provide accurate job descriptions and requirements</li>
              <li>Pay for services as agreed upon booking</li>
              <li>Treat service providers with respect and professionalism</li>
              <li>Leave honest and fair reviews</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">5. Payments</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Payments are processed through the platform via M-Pesa or card. Servio acts as a facilitator and is not responsible for the quality of services rendered. Disputes should be reported through the in-app reporting system.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">6. Prohibited Conduct</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">Users must not:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Post false, misleading, or fraudulent content</li>
              <li>Harass, threaten, or abuse other users</li>
              <li>Use the platform for illegal activities</li>
              <li>Attempt to circumvent platform payments</li>
              <li>Create multiple accounts or impersonate others</li>
              <li>Scrape, copy, or misuse platform data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">7. Account Suspension & Termination</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We reserve the right to suspend or terminate accounts that violate these terms. Suspended users will be notified of the reason and duration. Permanent bans may be applied for severe or repeated violations.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">8. Limitation of Liability</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Servio is a marketplace platform connecting clients and providers. We are not responsible for the quality of services provided, disputes between users, or any damages arising from use of the platform. Our liability is limited to the amount paid for the specific service in question.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">9. Intellectual Property</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All content, branding, and technology on Servio is owned by or licensed to us. Users retain ownership of content they upload but grant us a license to display it on the platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">10. Changes to Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may modify these terms at any time. Material changes will be communicated through the app. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">11. Governing Law</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              These terms are governed by the laws of the Republic of Kenya. Any disputes shall be resolved through arbitration in Nairobi, Kenya.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">12. Contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For questions about these Terms, contact us at legal@servio.app
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
