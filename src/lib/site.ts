import { getCollection, getEntry } from "astro:content";

export async function getSiteSettings() {
  const all = await getCollection("settings");
  const site =
    all.find((e) => e.id === "site" || e.id.endsWith("site") || e.id.includes("site")) ??
    all[0];
  if (!site) {
    return {
      college_name: "Al Jamia Arts & Science College",
      phone: "+917994188918",
      phone_display: "+91 7994 188918",
      email: "mail@ajascollege.ac.in",
      address:
        "Poopalam, Valambur (P.O), Perinthalmanna, Malappuram Dt, Kerala — 679325",
      admission_open: true,
      admission_label: "Admissions 2026 – 27",
      admission_url: "/admission/",
      admission_note: "FYUGP & PG programmes are open",
      fee_pdf: "/assets/uploads/2025/02/SF-FEE-Addndm.pdf",
      logo: "/assets/uploads/2024/01/AJAS-Website-Heading-Last.svg",
    };
  }
  return site.data;
}

export async function getHomepage() {
  const all = await getCollection("home");
  return all[0]?.data ?? null;
}

export async function getFooterSettings() {
  const all = await getCollection("footer");
  return all[0]?.data ?? null;
}

export async function getListings() {
  const all = await getCollection("listings");
  return all[0]?.data ?? null;
}

export async function getProspectus() {
  const all = await getCollection("prospectus");
  return all[0]?.data ?? null;
}
