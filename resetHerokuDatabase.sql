-- Note that current heroku plan only allows a single database, so creation of a new database is not required

-- Required to getting UUIDs working
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Since we only have one database, we cannot delte the old databas eand create a new one, so we have to remove all 
-- existing tables, then recreate them
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS blog_tags CASCADE;
DROP TABLE IF EXISTS blogs CASCADE;
DROP TABLE IF EXISTS auth_providers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- To create the users table
CREATE TABLE users (
id UUID PRIMARY KEY UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
username VARCHAR(50) UNIQUE NOT NULL,
password VARCHAR(300)
);

-- To create the refresh tokens table
CREATE TABLE refresh_tokens (
  token TEXT UNIQUE NOT NULL
);

-- To create the blogs table
CREATE TABLE blogs (
id UUID PRIMARY KEY UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL,
html TEXT NOT NULL,
css TEXT,
created TIMESTAMP NOT NULL,
last_edited TIMESTAMP,
summary_title TEXT,
summary_description TEXT,
summary_img TEXT,
FOREIGN KEY (user_id)
REFERENCES users (id)
);

-- To create the blog_tags table
CREATE TABLE blog_tags (
blog_id UUID NOT NULL,
tag TEXT NOT NULL,
PRIMARY KEY (blog_id, tag),
FOREIGN KEY (blog_id) REFERENCES blogs (id) ON DELETE CASCADE
);

-- To create the third party auth providers table
CREATE TABLE auth_providers (
user_id UUID NOT NULL,
provider VARCHAR(50) NOT NULL,
provider_user_id TEXT NOT NULL,
PRIMARY KEY (provider, provider_user_id),
FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);