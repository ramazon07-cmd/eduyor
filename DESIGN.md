# Design System: EduYor Workspace

Reference screen: **EduYor Request** (`/requests`). Every value below was measured from the running app or read from `frontend/app/requests/requests.css`, `frontend/components/app-sidebar.css` and the `:root` tokens. Use this file to prompt new screens so they read as the same product.

## 1. Visual Theme & Atmosphere

A quiet, paper-white workspace beside a deep night-plum sidebar. Content gets a lot of white space and few containers. Separation comes from hairlines and spacing, not boxes and shadows. One confident headline per page, one plum action, nothing decorative.

- **Density:** Daily App Balanced (4). Generous gaps, but every block does a job.
- **Variance:** Offset Asymmetric (5). Headings and copy sit on the left edge, and the single primary action pins to the right of the heading row. Nothing is centered except empty states.
- **Motion:** Static Restrained (3). Colour and press feedback only. The sidebar transition is the one choreographed move in the product.

The mood is calm and trustworthy, like a well-organised study room. It is for students, parents and mentors handling lessons and money, so clarity beats flourish.

## 2. Color Palette & Roles

**Neutrals (cool plum-grey family; never mix in warm beige greys)**
- **Lavender Canvas** (#FBF9FC): page background behind all content
- **Pure Surface** (#FFFFFF): cards, inputs, list items
- **Night Ink** (#241838): headlines and primary text
- **Muted Plum Grey** (#6B6280): secondary text token
- **Soft Lead Grey** (#79658C): lead paragraphs, idle tab labels, helper text on Request
- **Hairline** (#EBE4EF): structural 1px lines; toolbar divider variant #EEE6F4
- **Card Border** (#E9DFF1): 1px border on list items and detail cards
- **Input Border** (#E4DAEE): resting input and select border

**Brand accent (one, used sparingly)**
- **EduYor Plum** (#54218B): the only accent on a page. Primary button fill, active tab text, eyebrow text, empty-state icon, focus border (#68339C).
- **Plum Wash** (#EEE5F9): active tab and count-chip background. Never used as a page or section fill.
- **Empty Wash** (#FCF9FE): empty-state fill, paired with a dashed #EDE5F5 border.

**Sidebar (dark chrome only, never in content)**
- **Night Plum** (#340861): sidebar background
- **Active Glass**: rgba(255,255,255,0.09) fill with a rgba(255,255,255,0.12) 1px border on the active nav item
- **Coral Signal** (#FF8AA5): icon colour of the active nav item only

**Semantic (status only, never decorative)**
- **Open / success:** text #137868 on #E8F7F4
- **Matched:** text #54238A on #EEE5F9
- **Closed / neutral:** text #78688B on #F2EFF5
- **Brand Pink** (#D80C60): reserved for errors and urgent states. It never competes with Plum on the same component.

**Brand exception, stated plainly:** generic design rules ban "AI purple". EduYor Plum is the existing brand colour: deep, desaturated, flat fills, no gradients and no glows. That is the only form it may take.

## 3. Typography Rules

- **Family:** Figtree, loaded via `next/font` (`--font-sans`), falling back to Avenir Next and system-ui. One family for the whole product; no serif and no mono in the workspace.
- **Page title (H1):** clamp(26px, 3vw, 38px), weight 700, tracking -1.2px, line-height 1.18, Night Ink. One short declarative line, for example "Savol sizdan. Yechim mentordan."
- **Eyebrow:** 12px, weight 700, tracking 1.5px, uppercase, EduYor Plum. Above the page H1 only, never above every section.
- **Lead:** 14px, line-height 1.8, Soft Lead Grey, max-width 620px. One sentence that says what the page is for.
- **Card title:** 21px, line-height 1.4, tracking -0.4px.
- **Body:** 16px with line-height 1.65 at the document level; dense UI copy drops to 13–14px with line-height 1.8.
- **Meta and labels:** 12px. Form labels are 13px, weight 600.
- **Hierarchy** comes from weight and colour (Night Ink vs Soft Lead Grey) before size. Avoid giant display type inside the workspace.

## 4. Component Stylings

- **Primary button:** EduYor Plum fill, white label, 15px weight 650, padding 13px 21px, minimum height 48px, corners 11px. No shadow, no gradient, no glow. Leading icon allowed ("+ So'rov yaratish"). Hover deepens the fill to Deep Plum (#3C1878) and lifts the button 1px; on press it drops back to 0. One per page header.
- **Text link (secondary action):** plum text with a trailing arrow icon, no box.
- **Segmented tabs:** text-only buttons, 12px weight 600, padding 10px 13px, corners 8px. Idle tabs are Soft Lead Grey with a transparent fill. The active tab gets Plum Wash fill and #54238A text, with no underline and no border.
- **Select / input:** white fill, 1px Input Border, corners 10px, padding 11px 13px. Labels sit above the field at 13px/600, helper text below at 12px. Focus: 3px #E0D0F3 outline with a #68339C border. No floating labels, no placeholder-as-label.
- **List card:** white, 1px Card Border, corners 16px, padding 25px 27px. No shadow. A hairline footer (#F0EAF6) separates meta from the action link.
- **Status chip:** 12px weight 600, padding 5px 10px, corners 6px, semantic colours only.
- **Empty state:** Empty Wash fill, 1px dashed #EDE5F5 border, corners 22px, padding 44px 22px. Line-style plum icon (30px) top-left, a centered 23px/700 title, and one muted sentence saying what to do next. Add an action button only when the user can fix the emptiness themselves.
- **Loading:** skeleton blocks shaped like the final cards. No spinners in content areas.

**Corner-radius rule:** 6px chips, 8px tabs, 10–11px controls and buttons, 16px cards, 22px empty states and large panels. Do not introduce pill buttons or sharp 0px cards.

## 5. Layout Principles

- **Shell:** fixed sidebar (248px open, 232px at ≤1200px, 76px icon rail when collapsed) plus a content column with 28px top and 40px side padding.
- **Content width:** max 1140px, left-aligned inside the content column.
- **Page header:** a CSS grid or flex row with the eyebrow, H1 and lead stacked on the left and the single primary button on the right, vertically centered. 32px below the header.
- **Toolbar:** a 1px hairline on top with 18px vertical padding. Tabs sit on the left and the filter select (210px) on the right.
- **Rhythm:** 16px between list cards, 24px between major blocks, 32px after page headers.
- **Containers:** add a card only when it groups something you act on. Plain sections use spacing and hairlines.
- **Below 760px:** the sidebar becomes a top bar with a menu button. The header row stacks (CTA under the lead), the toolbar wraps, and all multi-column forms collapse to one column. No horizontal scroll, and touch targets are at least 44px.

## 6. Motion & Interaction

- **Default transitions:** colour, background and border at 0.2s ease on hover. Primary buttons lift 1px on hover and settle on press; sidebar nav items scale to 0.98 on press.
- **Sidebar:** width moves over 320ms with cubic-bezier(.32,.72,0,1). Labels leave together on collapse (110ms), then return staggered by 22ms per item on expand. In the rail, tooltips appear on hover and on keyboard focus.
- **Nothing loops.** No pulsing badges, shimmer on static content, floating cards or typewriter text in the workspace.
- **Animate only `transform` and `opacity`.** Grid-track width on the shell is the single documented exception.
- **`prefers-reduced-motion: reduce`:** every transition and keyframe above is switched off.

## 7. Anti-Patterns (Banned)

- No gradients, glows or coloured drop shadows on buttons or cards
- No second accent colour on a page; Brand Pink is for errors only
- No eyebrow above every section; one per page, above the H1
- No three equal feature cards in a row inside the workspace
- No thick coloured left border as a card accent
- No decorative status dots; colour appears only on real status chips
- No centered page headers; empty states are the only centered content
- No pure black (#000000) or pure white text on the light canvas
- No emojis in UI copy
- No placeholder-only form fields
- No serif fonts, and no Inter, inside the workspace
- No filler copy ("Elevate", "Seamless", "Unleash") and no scroll cues
- No em-dashes in headlines or button labels

## 8. Known Drift (fix before copying values)

- `:root` tokens are defined three times (`globals.css`, `theme.css`, `refresh.css`). The computed values above are the ones that win today.
- `requests.css` hard-codes its greys and plums (#79658C, #E9DFF1, #54238A) instead of reading tokens. New screens should add tokens for these roles rather than copy the hex values again.
- The Request create panel uses a 2px teal left border (`.request-create-note`). That conflicts with the side-border ban above, so treat it as legacy.
