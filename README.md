<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

This is NestJs based File management micro service that allows users to upload files to local storage,Aws and Azure cloud platform and they can interact with the files.

## Features

- User Registration: Users can register through registration form, upon registration successfull we can the user in the list
- List of Users: When you click on List users all the registered users will be listed in this screen.
- Upload Files: Users can upload files to Local Storage, Aws, or Azure based on users decision.
- File Operations:
   - Upload: Users can upload files to targetted Storage.
   - Open: Users can open the file and read the file.
   - Update: Users can update the existing content of the file.
   - Delete: Users can delete the files.
   - Download: Users can download the files.
   - View Thumbnails: If user uploads images we are generating thumbnails for those images and storing them.

## Technologies Used

- NestJs: A framework for building scalable Node.js server-side applications.
- Mongoose: We used mongoDB a NoSQL database for handling data storage.
- Aws:  A service for interaction of files with AWS.
- Azure: A service for interaction of files with Azure.

## API

### 1.Register
  - Endpoint: ``` /users ``` 
  - Method: POST
  - Request Body:
    ```
    {
      "name": "vishnu",
      "email": "vishnu@gmail.com",
      "phoneNumber": "1234567890" 
    }
    ```
  - Description: This Api will register new user.
### 2.List Users
  - Endpoint: ``` /users ``` 
  - Method: GET
  - Description: This Api will list all the registered users.

### 3.Upload File
  - Endpoint: ``` /files ``` 
  - Method: POST
  - Content-Type: multipart/form-data
  - Request Body: 
    ```
      {
        file: image.png
        userId: 423455hjhhjh43
        targettedStorage: AWS
      }
    ```
  - Description: This Api will upload the files based on targetted Storage.

### 4.Get Files by user
  - Endpoint: ``` /files/?userId=66dafd444769e8973c15618f ``` 
  - Method: GET
  - Description: This Api will get all the files for the selected user.

### 5.Open File
  - Endpoint: ``` /files/66dafd444769e8973c15618f ``` 
  - Method: GET
  - Description: This Api will get the content of the selected file.

### 6.Update File
  - Endpoint: ``` /files/66dafd444769e8973c15618f ``` 
  - Method: PATCH
  - Request Body: 
    ```
    {
      "content": "updated content adding test",
      "userId": "66e028f48840368de21c3a6f"
    }
    ```
  - Description: This Api will overwrite the exisiting content of the file.

### 7.Download File
  - Endpoint: ``` /files/66dafd444769e8973c15618f ``` 
  - Method: GET
  - Description: This Api will get the content of the selected file and sends the buffer.

### 8.Delete File
  - Endpoint: ``` /files/66e7be983ee3e26c06af349f?userId=66dafd444769e8973c15618f ``` 
  - Method: DELETE
  - Description: This Api will delete the file from the targetted Storage.

### 9.Get Thumbnails
  - Endpoint: ``` /files/thumbnails/66ebbc6263bac326915f2442 ``` 
  - Method: GET
  - Description: This Api will list the thumbails of a image.

## Installation

1. Clone the repository:
  ```
    git clone <repository-url>
    cd fileManagement-BE
  ```

2. Install the required dependencies:
  ```
  npm install
  ```

3. Set up environment variables by creating a .env file in the root directory with the following values:
  ```
    DB_URI=<your_db_url>
    AWS_ACCESS_KEY_ID=<your_aws_accessKey>
    AWS_SECRET_ACCESS_KEY=<your_aws_secret_access_key>
    AWS_REGION=<your_aws_region>
    AWS_S3_BUCKET=<your_aws_s3_bucket>
    IMAGE_PATH=<image_path_to_store_locally>
    CONNECTION_STRING=<your_connection_string>
    AZURE_CONTAINER_NAME=<your_container_name>
  ```

4. Run the application:
   ```
   npm run start:dev
   ```

## Running Tests

To run the tests for this application, use the following command:

```
npm run test
```

## Project Structure

```
src/
|-- files/               # File manipulation logic
|-- schemas/             # database schemas
|-- users/               # User management including registration and listing users
|-- app.module.ts        # Main application file
|-- main.ts              # Entry point of the application
|-- tests/               # Unit and integration tests
```

## License

Nest is [MIT licensed](LICENSE).
