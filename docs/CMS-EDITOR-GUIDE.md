# Editing the AJAS website — quick guide for college staff

Open **/admin/** on the website and sign in.

## The fastest way: edit right on the website

1. Open `/admin/` once in your browser and sign in. From then on, every page
   of the website shows a red bar in the bottom-left corner. Visitors never
   see it.
2. Go to the page you want to change and click **✎ Edit on this page**.
3. Everything you can change gets a dashed outline:
   - **Text**: click it and type. Press Enter when done.
   - **Photos**: click the photo and choose a new one from your computer.
   - Changed things turn **yellow** until you save.
4. Click **Save & publish**. Everyone sees the change in about 2–3 minutes.

**Undo all** throws away unsaved changes. **Done** stops editing. If you move
to another page while editing, editing stays on.

Some things can't be typed over on the page: adding or removing items,
changing where a link goes, on/off switches, and paragraphs with bold text,
links or tables. Clicking those explains why. **More options ↗** opens the
same page in the full CMS editor, where everything can be changed.

On another computer, or if the bar is missing, add `?edit` to the end of any
page address once, e.g. `https://ajascollege.ac.in/?edit`.

## See your change on the real page while you type

The right half of the editor shows **the actual website page**, not a
mock-up. As you type, the text and photos change on that page:

- **Yellow** = something you changed that isn't saved yet.
- **Click anything** on the page (a heading, a photo, a button) and the form
  jumps to the box that controls it. You never need to hunt for a field.
- If the dark bar at the top says *"N changes will appear after you save"*,
  you added a new item, a link or a switch. The page can only show those after
  saving.
- A brand-new news post, event or page has no page yet, so it is shown inside
  a similar existing page until you save.

To make the preview bigger, drag the divider between the form and the page.

## Sidebar sections in the CMS

| Section | What it changes |
| --- | --- |
| **Popup announcements** | The poster that pops up when someone opens the site |
| **News** / **Events** | Posts on /college-news/ and /event/ |
| **Notices & PDFs** | Documents on /notices/ (NIRF, AISHE, RTI, circulars…) |
| **Fees & prospectus PDFs** | Documents on /fees/ |
| **Homepage** | Every block on the homepage, listed top to bottom (① → ⑮) |
| **All other pages** | About, admission, hostel, labs, clubs, departments… |
| **Programmes** / **Faculty** | Course pages and teacher profiles |
| **Main menu** / **Footer** | Top menu and bottom area of every page |
| **List page intros** | Heading and intro text at the top of each list page |
| **Contact, phone & admission button** | Phone, email, address, header admission button, fee and prospectus PDFs |

Each entry also has a link in the editor toolbar that opens the published
page in a new tab.

## Common tasks

**Add a popup poster.** Popup announcements → New Popup → upload the poster,
optionally set a link (e.g. `/admission/`) and the start and end dates → Save.
It switches itself on and off on those dates. To check it before the start
date, open the site with `?popup=preview` at the end of the address. To hide it
early, untick **Switched on?**.

**Upload a PDF notice.** Notices & PDFs → New Notice → title, then drag the PDF
into the file box, pick a category → Save.

**Find an uploaded file again.** Click **Assets** at the top of the CMS.
Images are in the main library. PDFs, Word or Excel files and videos are under
**Documents, PDFs & videos** in the left column.

**Fix a typo or swap a photo.** Use **✎ Edit on this page** (above), the
quickest way.

**Add a news post or event.** Type the headline, set the date, add a photo and
the story. You don't type a web address: it's made from the headline.

**Add a page.** All other pages → pick a folder on the left (e.g. *labs*) →
New Page. Leave **Web address** empty and it becomes `/labs/<page-name>/`.

## Rules of thumb

- Write in the content box the way you would in Word. Don't paste HTML code.
- Put photo collections, staff lists and PDFs in their own fields
  (*Photo gallery*, *People*, *Downloads*), not in the content box. Those
  fields display properly on phones.
- To hide something without deleting it, tick **Hide from the website (draft)**.
