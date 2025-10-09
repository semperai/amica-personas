# Mobile Browser Support

This document explains how to fix common issues with Amica on mobile browsers, particularly Android.

## Known Issues and Fixes

### Issue 1: Black Screen on Brave Android

**Problem:** Amica shows only a black screen when loaded in Brave browser on Android.

**Cause:** Brave blocks `SharedArrayBuffer` by default for security reasons. ONNX Runtime (used for Voice Activity Detection) requires SharedArrayBuffer to function.

**Solution:** The server must send the following HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These headers are now automatically included in:
- Development server (via `vite.config.ts`)
- Production deployments (via `vercel.json` and `public/_headers`)

### Issue 2: VAD Not Detecting Voice on Chrome Android

**Problem:** Voice Activity Detection (VAD) doesn't detect voice input on Chrome for Android.

**Causes:**
1. AudioContext remains in "suspended" state until user interaction
2. Microphone permissions not properly granted
3. HTTPS requirement not met
4. AudioWorklet loading issues on mobile

**Solutions Implemented:**

1. **AudioContext Resume with Mobile-Specific Delays** (`real-time-vad.ts:670-697`)
   - Automatically resumes suspended AudioContext
   - Adds 100ms delay after resume for mobile stability
   - Provides clear error messages

2. **Enhanced Microphone Permission Handling** (`real-time-vad.ts:326-405`)
   - Validates audio tracks are present in stream
   - Detects mobile browsers and provides mobile-specific error messages
   - Handles common permission errors (NotAllowedError, NotFoundError, NotReadableError)

3. **Mobile Browser Compatibility Checks** (`validation.ts:182-250`)
   - Detects mobile browsers and shows appropriate warnings
   - Checks for HTTPS on mobile (required for microphone access)
   - Provides browser-specific guidance (Brave, Chrome Mobile, etc.)

## Deployment Configuration

### For Vercel

The `vercel.json` file in the root directory automatically configures the required headers.

### For Cloudflare Pages

Add a `public/_headers` file (already created):

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

### For Nginx

Add to your server configuration:

```nginx
location / {
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Embedder-Policy "require-corp" always;
}
```

### For Apache

Add to your `.htaccess`:

```apache
<IfModule mod_headers.c>
    Header set Cross-Origin-Opener-Policy "same-origin"
    Header set Cross-Origin-Embedder-Policy "require-corp"
</IfModule>
```

## Testing on Mobile

### Required Conditions

1. **HTTPS**: Mobile browsers require HTTPS for microphone access (except localhost)
2. **User Interaction**: AudioContext must be resumed after a user gesture (tap/click)
3. **Permissions**: User must grant microphone permissions

### Testing Checklist

- [ ] Site is served over HTTPS
- [ ] Headers are properly set (check browser developer tools → Network → Headers)
- [ ] Microphone permission is granted
- [ ] User interacts with page before VAD starts (tap screen, click button)
- [ ] Browser console shows no errors about SharedArrayBuffer
- [ ] Browser console shows AudioContext state transitions (suspended → running)

### Browser Console Logs

Look for these log messages to verify proper operation:

```
[VAD] Loading worklet from: ...
[VAD] Worklet loaded successfully
[VAD] AudioContext state: suspended
[VAD] AudioContext is suspended, resuming...
[VAD] AudioContext resumed, state: running
[MicVAD] Got media stream with 1 audio track(s)
[MicVAD] Start complete, listening: true
```

### Common Error Messages

**"SharedArrayBuffer not available"**
- Solution: Ensure server sends COOP/COEP headers

**"Microphone permission was denied"**
- Solution: User must allow microphone access in browser settings

**"Mobile browsers require HTTPS for microphone access"**
- Solution: Deploy to HTTPS or use localhost for testing

**"Failed to resume AudioContext"**
- Solution: Ensure user interacts with page before starting VAD

## Browser Compatibility

### Fully Supported
- ✅ Chrome Desktop
- ✅ Firefox Desktop
- ✅ Safari Desktop
- ✅ Edge Desktop

### Supported with Configuration
- ⚠️ Chrome Android (requires HTTPS + user interaction)
- ⚠️ Brave Desktop/Mobile (requires COOP/COEP headers)
- ⚠️ Safari iOS (requires HTTPS + user interaction)

### Limited Support
- ❌ Firefox Android (AudioWorklet issues, falls back to ScriptProcessor)
- ❌ Samsung Internet (limited WebAssembly support)

## Debugging Tips

1. **Check Headers**: Open browser DevTools → Network → Select main document → Check Response Headers for COOP/COEP

2. **Check SharedArrayBuffer**: Run in browser console:
   ```javascript
   typeof SharedArrayBuffer !== 'undefined'
   ```

3. **Check AudioContext State**: Run in browser console:
   ```javascript
   const ctx = new AudioContext();
   console.log(ctx.state); // Should show "running" after user interaction
   ```

4. **Enable Verbose Logging**: The VAD system logs extensively. Check browser console for detailed information about initialization and errors.

## Additional Resources

- [COOP/COEP Explanation](https://web.dev/coop-coep/)
- [SharedArrayBuffer Security Requirements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements)
- [AudioContext on Mobile](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext#autoplay_policy)
