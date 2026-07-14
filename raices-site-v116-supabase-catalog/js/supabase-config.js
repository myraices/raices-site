/* Raíces public Supabase configuration.
   Publishable browser credentials only. Security is enforced with RLS.
*/
(function () {
  const url = "https://tqtnffinhqbyesjdollk.supabase.co";
  const publishableKey = "sb_publishable_UzqAP9ZoPNJVtn1FKpoSNg_oNwvJgKW";

  window.RAICES_SUPABASE_URL = url;
  window.RAICES_SUPABASE_KEY = publishableKey;

  if (!window.raicesSupabase && window.supabase) {
    window.raicesSupabase = window.supabase.createClient(url, publishableKey);
  }
})();
