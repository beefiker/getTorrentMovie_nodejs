const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const request = require("request");
const app = express();
const dbconfig = require("./config/database.js");
const connection = mysql.createConnection(dbconfig);
const port = 7000;

app.locals.pretty = true;
app.set("view engine", "jade");
app.set("views", "./views");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: false }));

let movieGenres = [
  "Year",
  "Rating",
  "Action",
  "Drama",
  "Documentary",
  "Adventure",
  "Fantasy",
  "Horror",
  "Thriller",
  "Family",
  "Animation",
  "Crime",
  "Mystery",
  "Comedy",
  "Sci-Fi",
  "Romance",
  "History",
  "Sport",
  "War",
];
let sortByGenre = [];
let dateObj = new Date();
let getYear = dateObj.getFullYear();
let getMonth = dateObj.getMonth() + 1;
let getDay = dateObj.getDate();
let today = `${getYear}-${getMonth}-${getDay}`;
let expire_dateObj = new Date();
expire_dateObj.setDate(dateObj.getDate() + 7);
let expire_getYear = expire_dateObj.getFullYear();
let expire_getMonth = expire_dateObj.getMonth() + 1;
let expire_getDate = expire_dateObj.getDate();
let expireDay = `${expire_getYear}-${expire_getMonth}-${expire_getDate}`;

for (let i = 0; i < movieGenres.length; i++) {
  if (i < 2) {
    request("https://yts.mx/api/v2/list_movies.json?limit=50&sort_by=" + movieGenres[i], (err, res, body) => {
      sortByGenre[i] = JSON.parse(body);
    });
  } else {
    request("https://yts.mx/api/v2/list_movies.json?limit=50&genre=" + movieGenres[i], (err, res, body) => {
      sortByGenre[i] = JSON.parse(body);
    });
  }
}

app.get("/:id", (req, res) => {
  if (req.params.id < 2) {
    connection.query("select * from movie order by " + movieGenres[req.params.id] + " desc", (err, rows) => {
      if (err) console.log(err);
      res.render("index", { movie: rows, genres: movieGenres });
    });
  } else {
    connection.query(
      "select * from movie where genre like '%" + movieGenres[req.params.id] + "%' order by year desc",
      (err, rows) => {
        if (err) console.log(err);
        res.render("index", { movie: rows, genres: movieGenres });
      }
    );
  }
});

app.get("/", (req, res) => {
  for (let k = 0; k < movieGenres.length; k++) {
    let moviesArray = sortByGenre[k].data.movies;
    for (let i = 0; i < moviesArray.length; i++) {
      let movieGenre = "";
      let movieTorrentURL = "";
      let movieTorrentPixel = "";
      let torrents = moviesArray[i].torrents;

      for (let t = 0; t < torrents.length; t++) {
        movieTorrentURL = torrents[t].url;
        movieTorrentPixel = torrents[t].quality;
      }

      for (let j = 0; j < moviesArray[i].genres.length; j++) {
        if (j == moviesArray[i].genres.length - 1) movieGenre += moviesArray[i].genres[j];
        else movieGenre += moviesArray[i].genres[j] + ", ";
      }
      connection.query(
        `insert into movie values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          moviesArray[i].id,
          moviesArray[i].title_english.replace("'", ""),
          moviesArray[i].year,
          moviesArray[i].rating,
          moviesArray[i].runtime,
          movieGenre,
          moviesArray[i].language,
          moviesArray[i].summary.replace("'", "").slice(0, 80) + "...",
          moviesArray[i].summary.replace("'", ""),
          moviesArray[i].medium_cover_image,
          moviesArray[i].large_cover_image,
          movieTorrentURL,
          movieTorrentPixel,
          moviesArray[i].date_uploaded,
        ],
        (err, rows) => {
          if (err) console.log(err);
          console.log("Successfully pushed movies");
        }
      );
      connection.query("delete from reservation where expireDate ='" + today + "'", (err, rows) => {});
    }
  }

  connection.query("select * from movie order by year desc", (err, rows) => {
    if (err) console.log(err);
    res.render("index", { movie: rows, genres: movieGenres });
  });
});

app.post("/search", (req, res) => {
  let keyword = req.body.keyword;
  connection.query("select * from movie where title like '%" + keyword + "%'", (err, rows) => {
    if (err) console.log(err);

    if (rows.length == 0) {
      connection.query("select * from movie where genre like '%" + keyword + "%'", (err, rows) => {
        res.render("search", { movie: rows, genres: movieGenres, count: rows.length });
      });
    } else {
      res.render("search", { movie: rows, genres: movieGenres, count: rows.length });
    }
  });
});

app.post("/history", (req, res) => {
  let ip = req.body.ip;
  console.log(ip);
  // res.send(ip);
  connection.query("select * from reservation where ip like '" + ip + "'", (err, rows) => {
    if (err) console.log(err);
    res.render("history", { info: rows, ip: ip });
  });
});

// * method가 post 방식일 때의 값 전달 방식
app.post("/reservation", (req, res) => {
  let movieID = req.body.movieID;
  let movieTitle = req.body.movieTitle;
  let moviePoster = req.body.moviePoster;
  let movieGenres = req.body.movieGenre;
  let movieSummary = req.body.moviefullSummary;
  let url = req.body.movieTorrentUrl;
  let pixel = req.body.movieTorrentPixel;
  res.render("reservation", {
    title: movieTitle,
    genres: movieGenres,
    summary: movieSummary,
    poster: moviePoster,
    id: movieID,
    tdy: today,
    url: url,
    pixel: pixel,
  });
});

app.post("/result", (req, res) => {
  let movieTitle = req.body.movieTitle;
  let moviePoster = req.body.moviePoster;
  let movieID = req.body.movieID;
  let hours = req.body.reservationHour;
  let date = req.body.mdate;
  let url = req.body.movieTorrentUrl;
  let pixel = req.body.movieTorrentPixel;
  let ip = req.body.userIP;

  connection.query(
    `insert into reservation(ip, title, poster, expireDate, torrentUrl) values(?, ?, ?, ?, ?)`,
    [ip, movieTitle, moviePoster, expireDay, url],
    (err, rows) => {
      if (err) throw error;
    }
  );

  res.render("result", {
    id: movieID,
    poster: moviePoster,
    title: movieTitle,
    hours: hours,
    date: date,
    url: url,
    pixel: pixel,
    ip: ip,
    expireDay: expireDay,
  });
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
