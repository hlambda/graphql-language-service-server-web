console.log("regular javascript file");

const doSomethingWithGraphQLString = (str) => {
  // Fetch Hasura/GraphQL API do your magic...
  return str;
};

const gql = () => {
  return "aa";
};

export const aaa = gql`
  query www {
    configurations {
      key
    }
  }
`;

export const myQuery = gql`
  query a {
    configurations {
      key
      version
    }
  }
`;

console.log("regular javascript test file...");
