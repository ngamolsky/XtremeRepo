import { AlertCircle, Mail, Trophy, CheckCircle } from "lucide-react";
import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Xtreme Falcons
          </h1>
          <p className="text-muted-foreground">Relay Race Dashboard</p>
        </div>

        {/* Auth Form */}
        <Card>
          <CardHeader>
            <CardTitle>
              {isSignUp ? "Join the Team" : "Welcome Back"}
            </CardTitle>
            <CardDescription>
              Enter your Xtreme Falcons email to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="flex items-center p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-destructive mr-2 flex-shrink-0" />
                <span className="text-destructive text-sm">{error}</span>
              </div>
            )}

            {message && (
              <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
                <span className="text-green-700 text-sm">{message}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative flex items-center">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      id="email"
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.name"
                      className="pl-10 rounded-r-none border-r-0"
                      required
                    />
                  </div>
                  <div className="bg-muted px-3 py-2 border border-input border-l-0 rounded-r-md text-muted-foreground text-sm font-medium min-h-10 flex items-center">
                    @xtreme-falcons.com
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter just your username - we'll add @xtreme-falcons.com automatically
                </p>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Please wait...
                  </>
                ) : isSignUp ? (
                  "Create Account"
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="text-center">
              <Button
                variant="link"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm"
              >
                {isSignUp
                  ? "Already have an account? Sign in"
                  : "Don't have an account? Sign up"}
              </Button>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                This dashboard is for Xtreme Falcons team members only. All team
                members use the same secure password automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthForm;
