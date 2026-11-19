# Editing the AJAS website — quick guide for college staff

Open **/admin/** on the website and sign in.

## The fastest way: start from the page you want to change

1. Open `/admin/` once in your browser and sign in. From then on, every page of
   the website shows a red **✎ Edit this page** button in the bottom-left
   corner. Visitors never see it.
2. Go to the page you want to change and click the button. The CMS opens on
   exactly the right entry.
3. Make the change and click **Save**. The live site updates in about 2–3 minutes.

The **^** arrow next to the button has shortcuts for things that appear on
every page: the popup, the main menu, the footer, and the phone, email and
admission button. On list pages (News, Events, Notices…) it also has
**Add a new …**.

On another computer, or if the button is missing, add `?edit` to the end of
any page address once, e.g. `https://ajascollege.ac.in/?edit`.

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
