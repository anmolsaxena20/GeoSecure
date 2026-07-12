import { pool } from "../db/db.js";
import { generateEmbedding } from "./embedding.js";

export async function addDocument(

    title,

    content,

    metadata = {}

) {

    const embedding = await generateEmbedding(content);

    await pool.query(

        `

        INSERT INTO documents

        (

            title,

            content,

            embedding,

            metadata

        )

        VALUES

        (

            $1,

            $2,

            $3,

            $4

        )

        `,

        [

            title,

            content,

            JSON.stringify(embedding),

            metadata

        ]

    );

}