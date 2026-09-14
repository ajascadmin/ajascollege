import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const entrySchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  permalink: z.string(),
  type: z
    .enum(["home", "page", "listing", "profile", "article"])
    .default("page"),
  draft: z.boolean().default(false),
  date: z.coerce.date().optional(),
  image: z.string().optional(),
  name: z.string().optional(),
  role: z.string().optional(),
  credentials: z.string().optional(),
  attachments: z
    .array(z.object({ label: z.string(), file: z.string() }))
    .optional(),
  gallery: z.array(z.string()).optional(),
  people: z
    .array(
      z.object({
        photo: z.string().optional(),
        name: z.string(),
        role: z.string().optional(),
        phone: z.string().optional(),
        link: z.string().optional(),
      }),
    )
    .optional(),
  menu_items: z
    .array(
      z.object({
        title: z.string(),
        href: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .optional(),
  videos: z
    .array(
      z.object({
        file: z.string().optional(),
        url: z.string().optional(),
        caption: z.string().optional(),
      }),
    )
    .optional(),
});

const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/pages" }),
  schema: entrySchema,
});

const news = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/news" }),
  schema: entrySchema,
});

const events = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/events" }),
  schema: entrySchema,
});

const faculty = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/faculty" }),
  schema: entrySchema,
});

/** Day-to-day: programmes (UG/PG) */
const programmes = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/programmes" }),
  schema: z.object({
    title: z.string(),
    level: z.enum(["ug", "pg", "certificate", "other"]).default("ug"),
    order: z.number().default(0),
    permalink: z.string(),
    draft: z.boolean().default(false),
    description: z.string().optional(),
    duration: z.string().optional(),
    seats: z.string().optional(),
    department: z.string().optional(),
  }),
});

/** Day-to-day: circulars / mandatory docs / downloads */
const notices = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/notices" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().optional(),
    category: z
      .enum(["general", "academic", "compliance", "iqac", "mandatory", "admin", "admission"])
      .default("general"),
    file: z.string(),
    permalink: z.string(),
    draft: z.boolean().default(false),
    description: z.string().optional(),
  }),
});

/** Day-to-day: fee structure PDFs */
const fees = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/fees" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().optional(),
    file: z.string(),
    permalink: z.string(),
    draft: z.boolean().default(false),
    description: z.string().optional(),
  }),
});

/** Site-wide settings (contact, admission banner, key PDFs) */
const settings = defineCollection({
  loader: glob({ pattern: "site.json", base: "./content/settings" }),
  schema: z.object({
    college_name: z.string(),
    short_name: z.string().optional(),
    tagline: z.string().optional(),
    phone: z.string(),
    phone_display: z.string().optional(),
    email: z.string(),
    address: z.string(),
    logo: z.string().optional(),
    admission_open: z.boolean().default(true),
    admission_label: z.string().optional(),
    admission_url: z.string().optional(),
    admission_note: z.string().optional(),
    fee_pdf: z.string().optional(),
    prospectus_pdf: z.string().optional(),
  }),
});

/** Footer — trust marks, address/columns, social links, map, bottom nav. */
const footer = defineCollection({
  loader: glob({ pattern: "footer.json", base: "./content/settings" }),
  schema: z.object({
    trust_line: z.string().optional(),
    trust_marks: z
      .array(z.object({ image: z.string(), name: z.string() }))
      .default([]),
    columns: z
      .array(
        z.object({
          heading: z.string(),
          links: z.array(z.object({ label: z.string(), href: z.string() })),
        }),
      )
      .default([]),
    social: z
      .array(
        z.object({
          icon: z.string(),
          url: z.string(),
          label: z.string().optional(),
        }),
      )
      .default([]),
    map_embed_url: z.string().optional(),
    map_link_url: z.string().optional(),
    bottom_nav: z
      .array(z.object({ label: z.string(), href: z.string() }))
      .default([]),
  }),
});

/** Heading / SEO description / intro paragraph for each list page. */
const sectionSchema = z.object({
  title: z.string(),
  description: z.string(),
  intro: z.string(),
});
const listings = defineCollection({
  loader: glob({ pattern: "listings.json", base: "./content/settings" }),
  schema: z.object({
    news: sectionSchema,
    events: sectionSchema,
    notices: sectionSchema,
    fees: sectionSchema,
    programmes: sectionSchema,
    faculties: sectionSchema,
    departments: sectionSchema,
    labs: sectionSchema,
    clubs: sectionSchema,
  }),
});

/**
 * Homepage — every section is structured data so each component, card,
 * button and image on `/` is editable from the CMS (not baked into a
 * markdown/HTML blob). src/pages/index.astro renders one component per key.
 */
const home = defineCollection({
  loader: glob({ pattern: "**/*.{json,yml,yaml}", base: "./content/home" }),
  schema: z.object({
    title: z.string().default("Home"),
    description: z.string(),
    hero: z.object({
      video: z.string(),
    }),
    quick_actions: z.array(
      z.object({
        icon: z.string(),
        title: z.string(),
        subtitle: z.string(),
        cta_label: z.string(),
        url: z.string(),
        style: z.enum(["primary", "navy", "light"]).default("primary"),
      }),
    ),
    accreditation: z.object({
      label: z.string(),
      items: z.array(z.object({ image: z.string(), name: z.string() })),
    }),
    about: z.object({
      heading: z.string(),
      paragraphs: z.array(z.string()),
      cta_label: z.string(),
      cta_url: z.string(),
    }),
    metrics: z.array(z.object({ value: z.string(), label: z.string() })),
    chairman_message: z.object({
      kicker: z.string(),
      heading: z.string(),
      photo: z.string(),
      photo_url: z.string(),
      paragraphs: z.array(z.string()),
      cta_label: z.string(),
      cta_url: z.string(),
    }),
    principal_message: z.object({
      kicker: z.string(),
      heading: z.string(),
      photo: z.string(),
      photo_url: z.string(),
      quote: z.string(),
      bullet_points: z.array(z.string()),
      cta_label: z.string(),
      cta_url: z.string(),
    }),
    programmes: z.object({
      kicker: z.string(),
      heading: z.string(),
      intro: z.string(),
      ug: z.object({
        icon: z.string(),
        level_tag: z.string(),
        title: z.string(),
        meta: z.string(),
        items: z.array(z.object({ icon: z.string().optional(), label: z.string(), url: z.string() })),
        cta_primary_label: z.string(),
        cta_primary_url: z.string(),
        cta_secondary_label: z.string(),
        cta_secondary_url: z.string(),
      }),
      pg: z.object({
        icon: z.string(),
        level_tag: z.string(),
        title: z.string(),
        meta: z.string(),
        items: z.array(z.object({ icon: z.string().optional(), label: z.string(), url: z.string() })),
        highlight_icon: z.string().optional(),
        highlight_text: z.string(),
        cta_primary_label: z.string(),
        cta_primary_url: z.string(),
        cta_secondary_label: z.string(),
        cta_secondary_url: z.string(),
      }),
      departments_kicker: z.string(),
      departments_heading: z.string(),
      departments: z.array(
        z.object({
          icon: z.string(),
          badge_label: z.string(),
          image: z.string(),
          title: z.string(),
          url: z.string(),
          description: z.string(),
          pills: z.array(z.string()).default([]),
        }),
      ),
      view_all_label: z.string(),
      view_all_url: z.string(),
    }),
    gallery: z.object({
      kicker: z.string(),
      heading: z.string(),
      slides: z.array(
        z.object({ image: z.string(), title: z.string(), caption: z.string() }),
      ),
      cta_label: z.string(),
      cta_url: z.string(),
    }),
    services: z.object({
      items: z.array(
        z.object({
          icon: z.string(),
          title: z.string(),
          text: z.string(),
          cta_label: z.string(),
          cta_url: z.string(),
        }),
      ),
    }),
    benefits: z.object({
      heading: z.string(),
      items: z.array(
        z.object({ icon: z.string(), title: z.string(), text: z.string(), url: z.string() }),
      ),
      cta_heading: z.string(),
      cta_text: z.string(),
      cta_primary_label: z.string(),
      cta_primary_url: z.string(),
      cta_secondary_label: z.string(),
      cta_secondary_url: z.string(),
    }),
    events: z.object({
      heading: z.string(),
      items: z.array(
        z.object({
          title: z.string(),
          url: z.string(),
          date: z.string(),
          location: z.string(),
          image: z.string().optional(),
        }),
      ),
      cta_label: z.string(),
      cta_url: z.string(),
    }),
    testimonials: z.object({
      kicker: z.string(),
      heading: z.string(),
      items: z.array(
        z.object({
          photo: z.string(),
          quote: z.string(),
          name: z.string(),
          role: z.string(),
        }),
      ),
    }),
    quick_link_cta: z.object({
      kicker: z.string(),
      heading: z.string(),
      text: z.string(),
      primary_label: z.string(),
      primary_url: z.string(),
      secondary_label: z.string(),
      secondary_url: z.string(),
      quicklinks_heading: z.string(),
      quicklinks: z.array(
        z.object({ icon: z.string(), label: z.string(), url: z.string(), external: z.boolean().default(false) }),
      ),
    }),
  }),
});

/** The bespoke /prospectus-2026-27/ microsite — every string editable. */
const prospectus = defineCollection({
  loader: glob({ pattern: "prospectus.json", base: "./content/settings" }),
  schema: z.object({
    hero: z.object({
      eyebrow: z.string(),
      heading: z.string(),
      tagline: z.string(),
      lead: z.string(),
    }),
    about: z.object({
      heading: z.string().default("About Us"),
      paragraphs: z.array(z.string()),
    }),
    glance: z.array(z.object({ label: z.string(), value: z.string() })),
    vision: z.string(),
    mission: z.string(),
    committee: z.object({
      heading: z.string().default("Management Committee"),
      members: z.array(z.object({ name: z.string(), role: z.string() })),
      note: z.string().optional(),
    }),
    programmes: z.object({
      heading: z.string().default("Academic Programmes & Fees"),
      intro: z.string(),
      ug_heading: z.string().default("Undergraduate Honours Programmes"),
      ug: z.array(
        z.object({ name: z.string(), eligibility: z.string(), fee: z.string() }),
      ),
      pg_heading: z.string().default("Postgraduate Programmes"),
      pg: z.array(
        z.object({ name: z.string(), eligibility: z.string(), fee: z.string() }),
      ),
    }),
    addon: z.object({
      heading: z.string().default("Add-On / Certificate Courses"),
      intro: z.string(),
      courses: z.array(z.string()),
    }),
    infrastructure: z.object({
      heading: z.string().default("Infrastructure"),
      items: z.array(
        z.object({ icon: z.string(), title: z.string(), text: z.string() }),
      ),
    }),
    flagship: z.object({
      heading: z.string().default("Our Flagship Programmes"),
      items: z.array(z.object({ kicker: z.string(), text: z.string() })),
    }),
    admission: z.object({
      heading: z.string().default("Admission Process"),
      management_title: z.string().default("Management Admission"),
      management_steps: z.array(z.string()),
      merit_title: z.string().default("Merit Admission"),
      merit_steps: z.array(z.string()),
      note: z.string().optional(),
    }),
    download_cta: z.object({
      heading: z.string(),
      text: z.string(),
      button_label: z.string().default("Download Prospectus"),
    }),
  }),
});

export const collections = {
  pages,
  news,
  events,
  faculty,
  programmes,
  notices,
  fees,
  settings,
  footer,
  listings,
  prospectus,
  home,
};
