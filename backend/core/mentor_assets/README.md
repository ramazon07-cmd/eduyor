# Peer mentor portraits

`sat-v1.jpg` is the user-supplied photograph for Turobov Akbarshoh. It is only normalized using the existing avatar upload pipeline; no identity edits were made. His exact age and SAT score were not supplied, so the profile makes no claims about either.

The five other JPEGs are fictional people, generated with the built-in image_gen tool, then normalized through the avatar pipeline. Prompts requested exactly 18-year-old high school seniors; apparent age is an artistic target, not verification of a real person's age. Names are illustrative and biographies disclose this. IELTS results and support-teaching experience were provided by the user, without a certificate or independent verification. The tentative claim that practice essays scored 7+ was not presented as a verified exam result.

Common prompt for mathematics/admissions/programs/chinese:

> Create a single photorealistic square profile portrait for a peer learning website. [Subject below] Head and shoulders, centered face, looking at camera. Authentic school yearbook feel, soft natural window light, clean pastel gray classroom background blurred, no text, no badges, no logos, no academic gown or graduation cap. Youthful high school student rather than an older adult professional. Fictional person, not based on any real person. One person only. Final asset is a profile photograph, not a mockup or collage.

- mathematics: An exactly 18-year-old Uzbek male high school senior, short natural dark hair, clean shaven, navy school sweater over a white shirt, friendly focused expression.
- admissions: An exactly 18-year-old Uzbek female high school senior, dark shoulder length hair, cream blouse and muted lavender school cardigan, calm approachable expression.
- programs: An exactly 18-year-old Uzbek male high school senior, wavy dark hair, casual smart teal overshirt and white T-shirt, open confident smile.
- chinese: An exactly 18-year-old Uzbek female high school senior, dark hair tied back, pale blue school shirt, attentive friendly expression.

IELTS prompt:

> Create one photorealistic square profile portrait of a fictional exactly 18-year-old Uzbek female high school senior for an IELTS peer learning mentor profile. Dark straight hair just past shoulders, friendly attentive face with natural skin texture, white school blouse and simple navy cardigan. Head and shoulders, centered with space around hair, looking at camera, soft window daylight, blurred light gray classroom background. Authentic youthful student yearbook photography, not an older professional. No text, logos, flags, badges, graduation caps or academic gowns, one person only, not a collage.

All final assets live beside this README. `/media/avatars/curated/<filename>` serves them as a fallback when an uploaded copy is absent, so Render's ephemeral media disk cannot erase these directory portraits. No new persistent credentials are provisioned by `seed_peer_mentors`.
