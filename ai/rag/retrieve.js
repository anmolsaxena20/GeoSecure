import { pool } from "../db/db.js";

import { generateEmbedding } from "./embedding.js";

import { cosineSimilarity } from "./similarity.js";

export async function retrieveDocuments(query) {

    const queryEmbedding =

        await generateEmbedding(query);

    const docs =

        await pool.query(

            `

            SELECT *

            FROM documents

            `

        );

    const scored = docs.rows.map(doc => {

        return {

            ...doc,

            score:

                cosineSimilarity(

                    queryEmbedding,

                    doc.embedding

                )

        };

    });

    scored.sort(

        (a, b) =>

            b.score - a.score

    );

    return scored.slice(0, 5);

}