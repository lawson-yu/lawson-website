import { createYoga } from "graphql-yoga";

import { schema } from "@/server/graphql/schema";

const yoga = createYoga({
  graphqlEndpoint: "/api/graphql",
  schema,
});

export { yoga as GET, yoga as POST, yoga as OPTIONS };
