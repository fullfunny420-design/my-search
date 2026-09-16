const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   STATIC FRONTEND
========================================================= */

app.use(express.static(path.join(__dirname, "public")));

/* =========================================================
   PURILI WEB SEARCH
   Verified API:
   https://puri.li/api/search
========================================================= */

async function searchPurili(query, page) {
    const url =
        "https://puri.li/api/search?q=" +
        encodeURIComponent(query) +
        "&page=" +
        page;

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Accept": "application/json",
            "User-Agent": "MySearch/1.0"
        }
    });

    if (!response.ok) {
        throw new Error(
            "Purili HTTP " + response.status
        );
    }

    const data = await response.json();

    return data;
}

/* =========================================================
   WEB SEARCH API
========================================================= */

app.get("/api/search", async (req, res) => {

    const query =
        String(req.query.q || "").trim();

    const page =
        Math.max(
            1,
            parseInt(req.query.page) || 1
        );

    /* Empty search */

    if (!query) {
        return res.json({
            results: [],
            page: 1,
            hasMore: false,
            totalPages: 0
        });
    }

    try {

        console.log("");
        console.log(
            "======================================"
        );
        console.log(
            `Searching: "${query}"`
        );
        console.log(
            `Page: ${page}`
        );

        /* -----------------------------------------
           Ask Purili
        ----------------------------------------- */

        const data =
            await searchPurili(
                query,
                page
            );

        /* -----------------------------------------
           Convert Purili results to our format
        ----------------------------------------- */

        const results = [];

        if (
            data &&
            Array.isArray(data.results)
        ) {

            for (
                const item
                of data.results
            ) {

                if (
                    !item ||
                    !item.title ||
                    !item.url
                ) {
                    continue;
                }

                results.push({

                    title:
                        String(
                            item.title
                        ),

                    link:
                        String(
                            item.url
                        ),

                    description:
                        String(
                            item.description ||
                            ""
                        ),

                    displayUrl:
                        String(
                            item.displayUrl ||
                            item.url
                        ),

                    favicon:
                        item.favicon
                            ? (
                                item.favicon.startsWith("http")
                                    ? item.favicon
                                    : "https://puri.li" +
                                      item.favicon
                            )
                            : "",

                    source:
                        String(
                            item.source ||
                            "web"
                        )
                });
            }
        }

        /* -----------------------------------------
           Pagination
        ----------------------------------------- */

        const hasMore =
            Boolean(
                data.hasNext
            );

        const totalPages =
            Number(
                data.totalPages || 0
            );

        console.log(
            `Results received: ${results.length}`
        );

        console.log(
            `Has next page: ${hasMore}`
        );

        console.log(
            `Total pages: ${totalPages}`
        );

        console.log(
            "======================================"
        );

        /* -----------------------------------------
           Send response to frontend
        ----------------------------------------- */

        res.json({

            results:
                results,

            page:
                Number(
                    data.page || page
                ),

            hasMore:
                hasMore,

            totalPages:
                totalPages,

            total:
                Number(
                    data.total || 0
                ),

            correction:
                data.correction || null
        });

    } catch (error) {

        console.error("");
        console.error(
            "SEARCH ERROR:"
        );
        console.error(
            error.message
        );

        res.status(500).json({

            error:
                "Search failed",

            message:
                error.message,

            results:
                [],

            page:
                page,

            hasMore:
                false,

            totalPages:
                0
        });
    }
});

/* =========================================================
   IMAGE SEARCH
   Wikimedia Commons API
========================================================= */

app.get("/api/images", async (req, res) => {

    const query =
        String(req.query.q || "").trim();

    const page =
        Math.max(
            1,
            parseInt(req.query.page) || 1
        );

    /* Empty search */

    if (!query) {
        return res.json({

            images: [],

            page: 1,

            hasMore: false
        });
    }

    try {

        console.log("");
        console.log(
            `Image search: "${query}" | Page: ${page}`
        );

        /*
         * Wikimedia uses an offset.
         * 30 images are requested per page.
         */

        const offset =
            (page - 1) * 30;

        const url =
            "https://commons.wikimedia.org/w/api.php" +
            "?action=query" +
            "&generator=search" +
            "&gsrsearch=" +
            encodeURIComponent(query) +
            "&gsrnamespace=6" +
            "&gsrlimit=30" +
            "&gsroffset=" +
            offset +
            "&prop=imageinfo" +
            "&iiprop=url" +
            "&iiurlwidth=600" +
            "&format=json" +
            "&origin=*";

        const response =
            await fetch(url, {

                method: "GET",

                headers: {
                    "Accept":
                        "application/json",

                    "User-Agent":
                        "MySearch/1.0"
                }
            });

        if (!response.ok) {

            throw new Error(
                "Wikimedia HTTP " +
                response.status
            );
        }

        const data =
            await response.json();

        const images = [];

        /* -----------------------------------------
           Read Wikimedia images
        ----------------------------------------- */

        if (
            data.query &&
            data.query.pages
        ) {

            Object.values(
                data.query.pages
            ).forEach(
                imagePage => {

                    if (
                        imagePage.imageinfo &&
                        imagePage.imageinfo[0]
                    ) {

                        const info =
                            imagePage.imageinfo[0];

                        if (
                            info.thumburl
                        ) {

                            images.push({

                                image:
                                    info.thumburl,

                                original:
                                    info.descriptionurl ||
                                    info.url
                            });
                        }
                    }
                }
            );
        }

        console.log(
            `Images received: ${images.length}`
        );

        /*
         * Wikimedia generator/search can tell us
         * whether another continuation exists.
         */

        const hasMore =
            Boolean(
                data.continue
            ) &&
            images.length > 0;

        res.json({

            images:
                images,

            page:
                page,

            hasMore:
                hasMore
        });

    } catch (error) {

        console.error("");
        console.error(
            "IMAGE SEARCH ERROR:"
        );
        console.error(
            error.message
        );

        res.status(500).json({

            error:
                "Image search failed",

            message:
                error.message,

            images:
                [],

            page:
                page,

            hasMore:
                false
        });
    }
});

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", (req, res) => {

    res.json({

        ok: true,

        search:
            "Purili Web Search",

        images:
            "Wikimedia Commons",

        server:
            "MySearch"
    });
});

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, "0.0.0.0", () => {

    console.log("");

    console.log(
        "======================================"
    );

    console.log(
        "          MY SEARCH IS RUNNING"
    );

    console.log(
        "======================================"
    );

    console.log(
        `http://localhost:${PORT}`
    );

    console.log(
        "======================================"
    );

    console.log("");

});