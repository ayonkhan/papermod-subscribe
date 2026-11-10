// Stops early with a clear error when a setting is missing, instead of failing
// somewhere confusing later on. The names show up in the Functions logs.
export function missingSettings(env, names) {
    var missing = names.filter(function (name) { return !env[name]; });
    if (!missing.length) return null;
    console.error('Missing settings: ' + missing.join(', '));
    return new Response('The site is missing some settings. Please try again later.', { status: 500 });
}
