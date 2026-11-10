// Signs and checks confirmation links, so nobody can confirm an address they don't own
var encoder = new TextEncoder();

function getKey(secret) {
    return crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

function toHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(function (byte) { return byte.toString(16).padStart(2, '0'); })
        .join('');
}

function fromHex(hex) {
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}

export async function sign(message, secret) {
    var key = await getKey(secret);
    var signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return toHex(signature);
}

export async function verify(message, signature, secret) {
    if (!/^[0-9a-f]{64}$/.test(signature)) return false;
    var key = await getKey(secret);
    return crypto.subtle.verify('HMAC', key, fromHex(signature), encoder.encode(message));
}
