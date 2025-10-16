export interface IUser {
  id: string;
  username: string;
  profilePic?: string;
  bio: string;
  name: string;
  accessToken: string;
}

export const userList: IUser[] = [
  {
    id: '7386186383',
    username: 'Dummyuser1',
    name: 'Dummyuser1',
    bio: 'Hshsjsjs',
    accessToken:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGVmODc1ZGFiNDM4Y2UwYzkyNDJkN2UiLCJkZXZpY2VJZCI6ImFiYzEyMy1kZXZpY2UiLCJpYXQiOjE3NjA1Mjk0NzEsImV4cCI6MTc5MjA4NzA3MX0.lV6fOcIN4Cq1GiUmpuENmTL-mQPv5wWs5dwE2brTFiI',
  },
  {
    id: '68ef87acab438ce0c9242d9f',
    username: 'Dummyuser2',
    name: 'Dummyuser2',
    bio: 'Hshsjsjs',
    accessToken:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGVmODdhY2FiNDM4Y2UwYzkyNDJkOWYiLCJkZXZpY2VJZCI6ImFiYzEyMy1kZXZpY2UiLCJpYXQiOjE3NjA1Mjk1MDQsImV4cCI6MTc5MjA4NzEwNH0.VDgas9wULDAGf7pDhbKFG_6du0oVpNgQlcIdqOh91jE',
  },
  {
    id: '68ef87dbab438ce0c9242dbd',
    username: 'Dummyuser3',
    name: 'Dummyuser3',
    bio: 'Hshsjsjs',
    accessToken:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGVmODdkYmFiNDM4Y2UwYzkyNDJkYmQiLCJkZXZpY2VJZCI6ImFiYzEyMy1kZXZpY2UiLCJpYXQiOjE3NjA1Mjk1MzYsImV4cCI6MTc5MjA4NzEzNn0.reg07M9fFF1f-e2B6yt7L23bMzb-jDFnVfsN3h_CTk0',
  },
];
