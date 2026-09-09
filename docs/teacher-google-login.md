# Teacher Google login: 401 recovery

The reported failure is a Firebase Google sign-in error containing a 401 response from `https://www.googleapis.com/oauth2/v1/userinfo`. It happens before Firestore reads or writes. The screenshot does not establish whether the underlying cause is an invalid Google grant, missing scopes, or a Firebase/Google OAuth configuration problem. Production Google login has not been reproduced with the teacher's account.

The app continues to use Firebase's supported `GoogleAuthProvider` and popup flow. It now explicitly requests only the `openid`, `email`, and `profile` identity scopes and opens account selection. After the specific userinfo 401, the next user click requests fresh consent as well. A successful sign-in clears this recovery mode. There is no automatic second popup, sign-out, storage clearing, credential substitution, or permission-rule change. The student name-and-number flow is unchanged.

Teacher setup now reports this error before continuing to local setup, so a failed cloud login is not silently presented as an empty new notebook. If re-consent still fails, the message identifies the need to investigate project configuration instead of claiming the connection succeeded.

## User retry

1. Reload the updated site and open **Ayarlar → Buluta bağlan**.
2. Select the Google account used for the teacher's existing notebook.
3. If the 401 recovery message appears, click **Buluta bağlan** again and approve Google's sign-in consent.
4. If Google still rejects the login, keep the notebook intact and inspect the Firebase project's Google sign-in provider and its linked OAuth web client. Do not clear site data or use **Verileri sıfırla** to troubleshoot authentication.

These changes provide a controlled recovery attempt, not proof that the remote authorization problem is fixed. The unit tests simulate the reported error and verify popup timing, next-click re-consent, normal errors, recovery reset, visible setup feedback, and notebook preservation. They cannot validate Google's live token exchange or private project configuration.

References: [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin) documents provider scopes and custom parameters. [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect#re-consent) documents requesting consent again only when needed.
