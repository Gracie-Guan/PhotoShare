import uploadModel from "../models/uploadmodel";

const mysql = require("mysql");

class UploadController {
	async uploadFile(req, res) {
		try {
			console.log(req.body, req.files.picture);
			let image = req.files.picture;

			let renderParameters = {};

			if (await uploadModel.uploadImage(image)) {
				//we have an image that's not too big
				//we accept it to be an image
				//store it in the database
				const data = {
					upload_file_name: image.name,
					upload_path: "/uploads/resized/" + image.name,
					upload_author: 1,
					upload_description: req.body.caption,
				};

				if (!uploadModel.storeUploadData(data)) {
					console.log(
						"We were unable to store the upload metadata in the database"
					);
				}

				renderParameters = {
					title: req.body.caption,
					caption: req.body.caption,
					page: "uploadedpicture.ejs",
					image: data.upload_path,
				};
			} else {
				// return an error flash message
				renderParameters = {
					title: "Uploads",
					page: "uploadform.ejs",
					messages: { error: "Not an image" },
					caption: req.body.caption,
				};
			}
		} catch (error) {
			console.log(error);
			renderParameters = {
				title: "Uploads",
				page: "uploadform.ejs",
				messages: { error: "Something went wrong, please try again" },
				caption: req.body.caption,
			};
		}
		return res.render("templates/index.ejs", renderParameters);
	}
}

module.exports = new UploadController();