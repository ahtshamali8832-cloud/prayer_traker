/** Metro shim: Supabase realtime uses dynamic import('@supabase/node-fetch') on Node. Web/native use global fetch. */
module.exports = fetch;
module.exports.default = fetch;
