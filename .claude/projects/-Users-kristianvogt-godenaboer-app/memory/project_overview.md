---
name: Godenaboer App Project Overview
description: Expo/React Native app for sameie (housing cooperative) board members, sharing Supabase backend with godenaboer.no webapp
type: project
---

Mobile app for board members in Norwegian housing cooperatives (sameier).

**Stack:** Expo SDK, TypeScript, expo-router, NativeWind, Supabase JS client.

**Backend:** Shared Supabase project with godenaboer.no web app (URL: pwvdzipbdzwvxyumhbhn.supabase.co). Reuses existing users, RLS rules, and data.

**Key features:** Auth (email/password), home dashboard, agreements list, tickets with messaging, push notifications.

**Scope:** iOS primary, no admin features. Board members only see their own sameie via existing RLS.

**Why:** Extend godenaboer.no platform to mobile for board member convenience.
