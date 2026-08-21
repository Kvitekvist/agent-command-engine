#!/bin/bash
#
# Provision the local, self-signed code-signing certificate that macOS builds
# use (TICKET-0062). This is NOT an Apple Developer ID / notarization setup --
# it exists only to give ACE a *stable* code identity so macOS remembers the
# app's Screen Recording (TCC) grant across rebuilds instead of re-prompting
# after every ad-hoc build.
#
# Idempotent: if the identity already exists it does nothing. Safe to run from
# setup.sh on every setup.
#
# On non-macOS this is a no-op (Windows/Linux don't use this identity).
set -e

IDENTITY_NAME="Agent Command Engine Dev"

if [ "$(uname)" != "Darwin" ]; then
    echo "setup-mac-signing: not macOS, nothing to do."
    exit 0
fi

# Already provisioned? -> done.
if security find-identity -v -p codesigning 2>/dev/null | grep -q "$IDENTITY_NAME"; then
    echo "setup-mac-signing: code-signing identity \"$IDENTITY_NAME\" already present."
    exit 0
fi

echo "setup-mac-signing: creating self-signed code-signing identity \"$IDENTITY_NAME\"..."

KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

KEY="$WORKDIR/key.pem"
CERT="$WORKDIR/cert.pem"
P12="$WORKDIR/cert.p12"

# Self-signed cert with the Code Signing extended key usage. basicConstraints
# CA:false + EKU=codeSigning is what makes /usr/bin/codesign accept it.
openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$KEY" -out "$CERT" -days 3650 \
    -subj "/CN=$IDENTITY_NAME" \
    -addext "basicConstraints=critical,CA:false" \
    -addext "keyUsage=critical,digitalSignature" \
    -addext "extendedKeyUsage=critical,codeSigning" \
    >/dev/null 2>&1

# Bundle key+cert into a passwordless PKCS#12 for import.
openssl pkcs12 -export -out "$P12" -inkey "$KEY" -in "$CERT" \
    -name "$IDENTITY_NAME" -passout pass: >/dev/null 2>&1

# Import into the login keychain, authorizing codesign to use the private key
# without an interactive prompt on each build (-T /usr/bin/codesign).
security import "$P12" -k "$KEYCHAIN" -P "" \
    -T /usr/bin/codesign -T /usr/bin/security >/dev/null 2>&1

# Trust the cert for code signing so `codesign -v` / launch don't reject it.
# Best-effort: add-trusted-cert may prompt for the login password (GUI) and is
# not fatal if skipped -- signing works without it, only verification is stricter.
if ! sudo -n true 2>/dev/null; then
    security add-trusted-cert -d -r trustAsRoot \
        -p codeSign -k "$KEYCHAIN" "$CERT" >/dev/null 2>&1 || \
        echo "setup-mac-signing: note: could not auto-trust the cert (non-fatal); signing still works."
else
    sudo security add-trusted-cert -d -r trustAsRoot \
        -p codeSign -k /Library/Keychains/System.keychain "$CERT" >/dev/null 2>&1 || true
fi

if security find-identity -v -p codesigning 2>/dev/null | grep -q "$IDENTITY_NAME"; then
    echo "setup-mac-signing: identity \"$IDENTITY_NAME\" created."
else
    echo "setup-mac-signing: ERROR: identity was not created." >&2
    exit 1
fi
