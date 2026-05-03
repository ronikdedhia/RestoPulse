import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gradient-blue">RestoPulse</h1>
          <p className="text-muted-foreground mt-2 text-sm">Restaurant Intelligence Platform</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'glass-card shadow-none border-0 w-full',
              headerTitle: 'text-white',
              headerSubtitle: 'text-muted-foreground',
              socialButtonsBlockButton: 'glass border-border text-foreground hover:opacity-80',
              formFieldInput: 'glass-input rounded-lg px-3 py-2 text-sm w-full',
              formButtonPrimary: 'bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium',
              footerActionLink: 'text-blue-400 hover:text-blue-300',
            },
          }}
          fallbackRedirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
