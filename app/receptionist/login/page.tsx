"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, LogIn, Mail, Lock, Shield, Headset } from "lucide-react"
import { useAuth } from "@/components/AuthContext"

export default function ReceptionistLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/receptionist/intake"
  const { user, loading, refreshAuth } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loginAttempts, setLoginAttempts] = useState(0)

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

  useEffect(() => {
    if (!loading && user) {
      router.replace(redirect)
    }
  }, [loading, user, router, redirect])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (user) {
    return null
  }

  const login = async (e: React.FormEvent) => {
    e.preventDefault()

    if (loginAttempts >= 5) {
      setError("Too many login attempts. Please wait a moment before trying again.")
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const resp = await fetch(`${BACKEND_URL}/auth/receptionist/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setLoginAttempts((prev) => prev + 1)
        throw new Error(data?.error || `HTTP ${resp.status}`)
      }

      setLoginAttempts(0)
      await new Promise((resolve) => setTimeout(resolve, 500))
      await refreshAuth()
      router.replace(redirect)
    } catch (err: any) {
      setError(err?.message || "Failed to sign in")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Receptionist Login</h1>
          </div>
          <p className="text-gray-600">Front desk access only</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <LogIn className="h-5 w-5" /> Receptionist Authentication
            </CardTitle>
            <CardDescription>Enter your credentials to access the intake system</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={login} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="reception@hospital.com"
                    className="pl-10"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading || loginAttempts >= 5}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authenticating...
                  </>
                ) : (
                  <>
                    <Headset className="mr-2 h-4 w-4" /> Sign In
                  </>
                )}
              </Button>
            </form>

            {error && (
              <Alert className="mt-4 border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            {loginAttempts > 0 && (
              <p className="text-xs text-orange-600 mt-2">Login attempts: {loginAttempts}/5</p>
            )}
          </CardContent>
        </Card>

        <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-800">
            Your session is secured with HttpOnly cookies and encrypted tokens.
          </p>
        </div>
      </div>
    </div>
  )
}


