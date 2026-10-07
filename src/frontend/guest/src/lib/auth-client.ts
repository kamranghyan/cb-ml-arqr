import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  GlobalSignOutCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION ?? 'ap-south-1'
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!
const AUTH_API = process.env.NEXT_PUBLIC_API_AUTH!
const client = new CognitoIdentityProviderClient({ region: REGION })

async function callAuthService(path: string, body: object) {
  const res = await fetch(`${AUTH_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(text || res.statusText)
  return text ? JSON.parse(text) : {}
}

export const authClient = {
  login: (email: string, password: string) => callAuthService('/auth/login', { email, password }),
  refresh: (refreshToken: string) => callAuthService('/auth/refresh', { refreshToken }),

  setNewPassword: (email: string, newPassword: string, session: string) =>
    client.send(new RespondToAuthChallengeCommand({
      ClientId: CLIENT_ID, ChallengeName: 'NEW_PASSWORD_REQUIRED', Session: session,
      ChallengeResponses: { USERNAME: email, NEW_PASSWORD: newPassword },
    })),

  forgotPassword: (email: string) => client.send(new ForgotPasswordCommand({ ClientId: CLIENT_ID, Username: email })),

  confirmForgotPassword: (email: string, code: string, newPassword: string) =>
    client.send(new ConfirmForgotPasswordCommand({ ClientId: CLIENT_ID, Username: email, ConfirmationCode: code, Password: newPassword })),

  signUp: (email: string, password: string) =>
    client.send(new SignUpCommand({ ClientId: CLIENT_ID, Username: email, Password: password, UserAttributes: [{ Name: 'email', Value: email }] })),

  confirmSignUp: (email: string, code: string) =>
    client.send(new ConfirmSignUpCommand({ ClientId: CLIENT_ID, Username: email, ConfirmationCode: code })),

  signOut: (accessToken: string) => client.send(new GlobalSignOutCommand({ AccessToken: accessToken })),
}