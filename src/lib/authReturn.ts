/**
 * Coming back from Google or from the link in a confirmation mail. Supabase sends you to
 * /#access_token=… or, when it failed, to /#error=…&error_code=…. The HashRouter reads that
 * as a page that does not exist; this tells such a return apart from a real unknown page.
 */
export interface AuthReturn {
  /** The code Supabase gave along, such as 'otp_expired'; null when it looks like a success. */
  errorCode: string | null;
}

/** `path` is the router's pathname, e.g. "/access_token=…&refresh_token=…". */
export const readAuthReturn = (path: string): AuthReturn | null => {
  const params = new URLSearchParams(path.replace(/^[/#]+/, ''));
  if (params.has('access_token')) return { errorCode: null };
  if (params.has('error') || params.has('error_code') || params.has('error_description')) {
    return { errorCode: params.get('error_code') || params.get('error') || null };
  }
  return null;
};
