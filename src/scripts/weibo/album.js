/*
 * Copyright (c) 2018 The Weibo-Picture-Store Authors. All rights reserved.
 * Use of this source code is governed by a MIT-style license that can be
 * found in the LICENSE file.
 */

import {Utils} from "../sharre/utils.js";
import {FEATURE_ID} from "../sharre/constant.js";
import {USER_INFO_CACHE, USER_INFO_EXPIRED} from "../sharre/constant.js";
import {requestUserId} from "./author.js";

/**
 * @desc Singleton
 * @return {Promise<{uid: string, albumId: string}, {canCreateNewAlbum: boolean}|Error>}
 */
async function tryCheckoutSpecialAlbumId() {
    const overflow = 100;
    return Utils
        .fetch(Utils.buildURL("http://photo.weibo.com/albums/get_all", {page: 1, count: overflow}))
        .then(response => response.ok ? response.json() : Promise.reject(new Error(response.statusText)))
        .then(json => {
            if (json && json["result"]) {
                const albumInfo = {counter: 0, uid: null, albumId: null};

                for (const item of json["data"]["album_list"]) {
                    albumInfo.counter++;
                    if (item["description"] === FEATURE_ID) {
                        albumInfo.uid = item['uid'].toString();
                        albumInfo.albumId = item["album_id"].toString();
                        break;
                    }
                }

                if (albumInfo.albumId) {
                    return Promise.resolve({
                        uid: albumInfo.uid,
                        albumId: albumInfo.albumId,
                    });
                } else {
                    return Promise.reject({
                        canCreateNewAlbum: albumInfo.counter < overflow,
                    });
                }
            } else {
                return Promise.reject(new Error("Invalid Data"));
            }
        });
}

/**
 * @desc Singleton
 * @desc Referer wanted: "${protocol}//photo.weibo.com/${uid}/client"
 * @return {Promise<{uid: string, albumId: string}, Error>}
 */
async function tryCreateNewAlbum() {
    const method = "POST";
    const body = Utils.createSearchParams({
        property: "2",
        caption: "Weibo_Chrome",
        description: FEATURE_ID,
        answer: "",
        question: "",
        album_id: "",
    });
    return Utils
        .fetch("http://photo.weibo.com/albums/create", {method, body})
        .then(response => response.ok ? response.json() : Promise.reject(new Error(response.statusText)))
        .then(json => {
            if (json && json["result"]) {
                return {
                    uid: json["data"]["uid"].toString(),
                    albumId: json["data"]["album_id"].toString(),
                };
            } else {
                return Promise.reject(new Error("Invalid Data"));
            }
        });
}

/**
 * @package
 * @param {string} [uid]
 * @return {Promise<{uid: string, albumId: string}, Error>}
 */
export async function requestSpecialAlbumId(uid) {
    const cacheId = uid || await requestUserId().then(info => info.uid).catch(Utils.noop);

    if (cacheId && USER_INFO_CACHE.has(cacheId)) {
        const albumInfo = USER_INFO_CACHE.get(cacheId);
        if (albumInfo && albumInfo.albumId && albumInfo.uid === cacheId &&
            Date.now() - albumInfo.timestamp < USER_INFO_EXPIRED) {
            return Promise.resolve(albumInfo);
        } else {
            USER_INFO_CACHE.delete(cacheId);
        }
    }

    return Utils.singleton(tryCheckoutSpecialAlbumId)
        .catch(reason => {
            if (reason && reason.canCreateNewAlbum != null) {
                if (reason.canCreateNewAlbum) {
                    return Utils.singleton(tryCreateNewAlbum);
                } else {
                    return Promise.reject(new Error("Cannot create new album"));
                }
            } else {
                return Promise.reject(reason);
            }
        })
        .then(albumInfo => {
            if (albumInfo && albumInfo.albumId && albumInfo.uid) {
                USER_INFO_CACHE.set(albumInfo.uid, Object.assign({
                    timestamp: Date.now(),
                }, albumInfo));
            }
            return albumInfo;
        });
}
