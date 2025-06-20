import { AlertCircle, Mail, Trophy } from "lucide-react";
import React, { useState } from "react";
import { supabase } from "../lib/supabase";

const AuthForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const validateEmail = (email: string) => {
    // Since we now have a visual suffix, users only enter their username
    // So we just need to check that it's not empty and doesn't contain @
    return email.length > 0 && !email.includes("@");
  };

  // Helper to normalize email - always append @xtreme-falcons.com
  const normalizeEmail = (email: string) => {
    // Remove any @xtreme-falcons.com if user somehow added it
    const cleanUsername = email.replace("@xtreme-falcons.com", "").trim();
    return `${cleanUsername}@xtreme-falcons.com`;
  };

  const getRedirectUrl = () => {
    // This will use the current origin (protocol + host + port)
    return `${window.location.origin}/`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (!validateEmail(email)) {
      setError("Please enter your username (without @xtreme-falcons.com)");
      setLoading(false);
      return;
    }

    // Normalize email before sending to Supabase
    const normalizedEmail = normalizeEmail(email);

    // Use the default team password
    const authPassword = "XtremeFalcons2024!";

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: authPassword,
          options: {
            emailRedirectTo: getRedirectUrl(),
          },
        });

        if (error) throw error;
        setMessage("Check your email for the confirmation link!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: authPassword,
        });

        console.log(error);

        if (error) {
          // If sign in fails, try to sign up automatically
          const { error: signUpError } = await supabase.auth.signUp({
            email: normalizedEmail,
            password: authPassword,
            options: {
              emailRedirectTo: getRedirectUrl(),
            },
          });

          if (signUpError) throw signUpError;
          setMessage(
            "Account created! Check your email for the confirmation link."
          );
        }
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Xtreme Falcons
          </h1>
          <p className="text-gray-600">Relay Race Dashboard</p>
        </div>

        {/* Auth Form */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {isSignUp ? "Join the Team" : "Welcome Back"}
            </h2>
            <p className="text-gray-600 text-sm">
              Enter your Xtreme Falcons email to access the dashboard
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-green-700 text-sm">{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email Address
              </label>
              <div className="relative flex items-center">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.name"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                    required
                  />
                </div>
                <div className="bg-gray-100 px-3 py-3 border border-l-0 border-gray-300 rounded-r-lg text-gray-600 text-sm font-medium">
                  @xtreme-falcons.com
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter just your username - we'll add @xtreme-falcons.com
                automatically
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? "Please wait..."
                : isSignUp
                  ? "Create Account"
                  : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center">
              This dashboard is for Xtreme Falcons team members only. All team
              members use the same secure password automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
