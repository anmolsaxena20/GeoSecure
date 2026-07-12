import { retrieveDocuments } from "./retrieve.js";

export async function buildContext(question) {

    const docs =

        await retrieveDocuments(question);

    let context = "";

    docs.forEach(doc => {

        context +=

            `

Title:

${doc.title}

Content:

${doc.content}

-----------------------

`;

    });

    return context;

}