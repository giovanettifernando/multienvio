import { redirect } from 'next/navigation';

/**
 * Redirect to the main login page at /auth/login
 * This ensures we have a single login page for client users
 */
export default function LoginRedirect() {
  redirect('/auth/login');
}
