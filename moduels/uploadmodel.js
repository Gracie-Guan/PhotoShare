const sharp = require("sharp");
const fs = require("fs");
const QueryBuilder = require("node-querybuilder");

const dbConfig = require("../database/dbconfig");

const pool = new QueryBuilder(dbConfig, "mysql", "pool");

class UploadModel {
	async uploadImage(image) {
		const acceptedMimeTypes = [
			"image/gif",
			"image/jpeg",
			"image/png",
			"image/webp",
		];

		const resizeWidth = 500;

		if (acceptedMimeTypes.indexOf(image.mimetype) >= 0) {
			// it's ok, we have an image that is not too large and has an accepted mimetype
			const imageDestinationPath =
				__dirname + "/../assets/uploads/" + image.name;
			await image.mv(imageDestinationPath);

			const resizedImagePath =
				__dirname + "/../assets/uploads/resized/" + image.name;
			await sharp(imageDestinationPath)
				.resize(resizeWidth)
				.toFile(resizedImagePath);

			fs.unlink(imageDestinationPath, function (err) {
				if (err) throw err;
				console.log(imageDestinationPath + " deleted");
			});
			return true;
		} else {
			console.log("unable to upload image");
			return false;
		}
	}

	async storeUploadData(data) {
		let querybuilder;
		try {
			querybuilder = await pool.get_connection();
			querybuilder.insert("uploads", data, (err, res) => {
				console.log("Query Ran: " + querybuilder.last_query());

				if (err) return console.error(err);
				console.log("insert id:", res.insert_id);
				return true; //we've managed to store data in the dbase
			});
		} catch (error) {
			console.log("insert upload error", error);
			return false; //we've NOT managed to store data in the dbase
		} finally {
			if (querybuilder) querybuilder.release(data);
		}
	}
}

module.exports = new UploadModel();