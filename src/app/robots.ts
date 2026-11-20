import { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
    const siteUrl = getSiteUrl();
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: [
                "/api/",
                "/admin/",
                "/dashboard/",
                "/login",
                "/register",
                "/suggest/",
                "/*/admin/",
                "/*/dashboard/",
                "/*/login",
                "/*/register",
                "/*/suggest/",
            ],
        },
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}
