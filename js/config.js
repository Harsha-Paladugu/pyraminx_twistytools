/* Pyraminx.net — shared site config.
   This single block is loaded by every page so login + per-user data work
   site-wide. Leave firebase:null to run in demo mode (data stays in this
   browser). The apiKey here is a public client identifier, not a secret —
   access is controlled by the Firestore security rules. The firebase block
   points at the shared TwistyTools project, which serves all three puzzle
   sites; `puzzle` picks this site's slice of it. */
window.OO_CONFIG = {
  puzzle: 'pyraminx',   // namespaces this site's Firestore paths in the shared project
  firebase: {
    apiKey: "AIzaSyC5b82XjgZ26GsVvgTO0nCK_KiltQhRozM",
    authDomain: "twistytools-3bf66.firebaseapp.com",
    projectId: "twistytools-3bf66",
    appId: "1:446558622358:web:b99303e5695392108e68b7"
  },

  adminEmails: ["harsha.paladugu2@gmail.com"],   // your Google account email

  // Public Google Form where visitors can apply to become a moderator. Paste
  // the form's share URL here; the OO page links it wherever it invites people
  // to request access. Leave "" to show a "not open yet" note instead of a link.
  moderatorFormUrl: "https://forms.gle/CNjAEA4RudvTLdmD9"
};
